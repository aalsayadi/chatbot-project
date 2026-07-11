"""FastAPI web server wrapping the existing chat pipeline as an HTTP API.

This exposes the same logic the CLI (`main.py`) runs each turn -- sentiment,
memory, prompt building, Ollama, and TTS -- over HTTP so the React UI can talk
to it. The heavy models are loaded once at import time (as in `main.py`).

Run with:  uvicorn server:app --port 8000
"""

import os
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_HUB_VERBOSITY"] = "error"

import asyncio
import base64
import json
import threading

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from memory.memory_manager import MemoryManager
from sentiment.sentiment_analyzer import SentimentAnalyzer
from llm.ollama_client import OllamaClient
from prompt.prompt_builder import PromptBuilder
from voice.tts import synthesize, voice_for_persona, VOICES

# --- Load models / clients once at startup (mirrors main.py) ---------------
memory = MemoryManager()
sentiment = SentimentAnalyzer()
llm = OllamaClient()
prompt_builder = PromptBuilder()

# The pipeline mutates shared state (short-term memory, SQLite). Serialize
# turns so concurrent requests can't interleave. Fine for a local app.
_pipeline_lock = threading.Lock()

# Map the sentiment classifier's labels to avatar emotions. Per the avatar
# team's note we avoid "happy"/"surprised" and use "relaxed" for positive.
SENTIMENT_TO_EMOTION = {
    "POSITIVE": "relaxed",
    "NEGATIVE": "sad",
}
DEFAULT_EMOTION = "default"

app = FastAPI(title="ConvAgent Chat API")

# The Vite dev server proxies /api to us, but allow direct cross-origin calls
# too (e.g. running the UI and API on different hosts/ports).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    persona: str = "male"        # male | female | robot -> selects the voice
    voice_mode: bool = True      # shorten replies for spoken TTS
    # Off by default: audio is generated lazily. Text mode never sets this, so
    # /chat does no TTS work; voice mode sets it True to get audio inline.
    # On-demand playback in text mode goes through POST /tts instead.
    tts: bool = False


class ChatResponse(BaseModel):
    reply: str
    sentiment: str
    emotion: str
    voice: str
    audio: str | None = None     # base64-encoded WAV, or None if tts disabled


class TTSRequest(BaseModel):
    text: str
    persona: str = "male"


class TTSResponse(BaseModel):
    audio: str | None = None     # base64-encoded WAV
    voice: str


class TitleRequest(BaseModel):
    # A compact transcript snippet (or just the first user message) to title.
    text: str


class TitleResponse(BaseModel):
    title: str


def run_turn(message: str, voice_mode: bool) -> tuple[str, str]:
    """Run one chat turn through the existing pipeline.

    Returns (reply, sentiment_label). Mirrors the body of main.py's loop.
    """
    sentiment_label = sentiment.analyze(message)

    memory.process_user_message(message)
    memories = memory.retrieve_relevant_memories(message)

    messages = prompt_builder.build_prompt(
        sentiment_label,
        memories,
        memory.get_recent_messages(),
        message,
        voice_mode=voice_mode,
    )

    reply = llm.chat(messages)
    memory.add_assistant_message(reply)

    return reply, sentiment_label


@app.get("/health")
def health():
    return {"status": "ok", "personas": list(VOICES.keys())}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    with _pipeline_lock:
        reply, sentiment_label = run_turn(req.message, req.voice_mode)

    emotion = SENTIMENT_TO_EMOTION.get(sentiment_label, DEFAULT_EMOTION)
    voice = voice_for_persona(req.persona)

    audio_b64 = None
    if req.tts and reply.strip():
        wav_bytes = synthesize(reply, voice=voice)
        if wav_bytes:
            audio_b64 = base64.b64encode(wav_bytes).decode("ascii")

    return ChatResponse(
        reply=reply,
        sentiment=sentiment_label,
        emotion=emotion,
        voice=voice,
        audio=audio_b64,
    )


@app.post("/tts", response_model=TTSResponse)
def tts(req: TTSRequest):
    """Synthesize speech for an arbitrary piece of text on demand.

    Used by the "play this reply aloud" speaker button in text mode, where
    /chat deliberately skips synthesis.
    """
    voice = voice_for_persona(req.persona)
    audio_b64 = None
    if req.text.strip():
        wav_bytes = synthesize(req.text, voice=voice)
        if wav_bytes:
            audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
    return TTSResponse(audio=audio_b64, voice=voice)


def _clean_title(raw: str, fallback: str) -> str:
    """Normalize an LLM title response into a short, sidebar-friendly title."""
    text = (raw or "").strip()

    # Take the first non-empty line (models sometimes add explanation after).
    for line in text.splitlines():
        if line.strip():
            text = line.strip()
            break

    # Strip surrounding quotes and common prefixes the model may add.
    text = text.strip().strip('"').strip("'").strip()
    lowered = text.lower()
    for prefix in ("title:", "topic:", "conversation:"):
        if lowered.startswith(prefix):
            text = text[len(prefix):].strip()
            break

    # Keep it short: at most 6 words and ~40 characters, no trailing punctuation.
    words = text.split()
    if len(words) > 6:
        text = " ".join(words[:6])
    text = text[:40].strip().rstrip(".,;:!-")

    return text or fallback


def _fallback_title(snippet: str) -> str:
    """Derive a usable title from the raw transcript snippet."""
    first_line = ""
    for line in snippet.splitlines():
        if line.strip():
            first_line = line.strip()
            break
    # Drop a leading "User:"/"Assistant:" label if present.
    for label in ("User:", "Assistant:", "user:", "assistant:"):
        if first_line.startswith(label):
            first_line = first_line[len(label):].strip()
            break
    first_line = first_line[:40].strip()
    return first_line or "New conversation"


@app.post("/title", response_model=TitleResponse)
def title(req: TitleRequest):
    """Generate a short conversation title from its content via the LLM.

    Falls back to a trimmed snippet if the model misbehaves, so the caller
    always gets something usable.
    """
    snippet = req.text.strip()
    fallback = _fallback_title(snippet)

    if not snippet:
        return TitleResponse(title=fallback)

    system = (
        "You create short titles for chat conversations. "
        "Read the conversation and reply with a title of 2 to 4 words that "
        "describes what it is about. "
        "Reply with ONLY the title -- no quotes, no punctuation, no prefix "
        "such as 'Title:', and no explanation."
    )
    try:
        with _pipeline_lock:
            raw = llm.chat([
                {"role": "system", "content": system},
                {"role": "user", "content": snippet},
            ])
        return TitleResponse(title=_clean_title(raw, fallback))
    except Exception:
        return TitleResponse(title=fallback)


# --- Streaming voice transcription (cross-browser) -------------------------
# The browser streams 16 kHz mono Int16 PCM over this WebSocket while the user
# is speaking. The server runs Silero VAD for endpointing and faster-whisper
# for transcription -- the SAME stack the CLI uses -- so voice input works in
# every major browser (no Web Speech API dependency).
#
# Protocol:
#   client -> server: binary Int16 PCM frames; or text {"type":"reset"}
#   server -> client: {"type":"speech_start"}
#                     {"type":"speech_end"}
#                     {"type":"transcript","text": "..."}
#                     {"type":"error","message": "..."}
@app.websocket("/ws/transcribe")
async def ws_transcribe(ws: WebSocket):
    await ws.accept()
    loop = asyncio.get_event_loop()

    # Import + model load can be slow the first time; do it off the event loop.
    try:
        from voice.stt import SileroEndpointer, transcribe_pcm
        endpointer = await loop.run_in_executor(None, SileroEndpointer)
    except Exception as exc:  # e.g. silero-vad / faster-whisper not installed
        await ws.send_json({"type": "error", "message": f"voice unavailable: {exc}"})
        await ws.close()
        return

    try:
        while True:
            message = await ws.receive()

            if message["type"] == "websocket.disconnect":
                break

            data = message.get("bytes")
            if data is not None:
                pcm = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                events = await loop.run_in_executor(None, endpointer.process, pcm)
                for kind, payload in events:
                    if kind == "start":
                        await ws.send_json({"type": "speech_start"})
                    elif kind == "utterance":
                        await ws.send_json({"type": "speech_end"})
                        text = await loop.run_in_executor(
                            None, transcribe_pcm, payload, 16000
                        )
                        await ws.send_json({"type": "transcript", "text": text})
                continue

            text_msg = message.get("text")
            if text_msg:
                try:
                    control = json.loads(text_msg)
                except ValueError:
                    control = {}
                if control.get("type") == "reset":
                    await loop.run_in_executor(None, endpointer.reset)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await ws.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
