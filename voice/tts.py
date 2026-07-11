import io
import os
import platform

import numpy as np
import soundfile as sf
from kokoro import KPipeline

# 'a' = American English
pipeline = KPipeline(lang_code="a")

# Preset voice IDs for each selectable persona.
VOICES = {
    "male": "am_puck",     # young, energetic American male
    "female": "af_heart",  # default American female voice
    "robot": "am_fenrir",  # deep American male, used for the robot persona
}

DEFAULT_VOICE = VOICES["male"]

# Audio sample rate produced by the Kokoro pipeline.
SAMPLE_RATE = 24000

OUTPUT_FILE = "response.wav"


def voice_for_persona(persona: str) -> str:
    """Map a persona name (male/female/robot) to its Kokoro voice ID.

    Falls back to the default voice for unknown personas. This keeps the
    persona -> voice mapping authoritative in one place so the web server
    and CLI stay in sync.
    """
    return VOICES.get(persona, DEFAULT_VOICE)


def _render(text: str, voice: str) -> "np.ndarray | None":
    """Run the Kokoro pipeline and return the concatenated audio, or None."""
    chunks = []
    for _, _, audio in pipeline(text, voice=voice, speed=1.0):
        chunks.append(audio)

    if not chunks:
        return None

    return np.concatenate(chunks)


def synthesize(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    """Convert text to speech and return WAV-encoded bytes.

    Unlike `speak`, this does not play audio on the server -- it returns the
    encoded audio so a web client can play it in the browser (which is what
    drives the avatar's lip-sync and "speaking" state).
    """
    full_audio = _render(text, voice)
    if full_audio is None:
        return b""

    buffer = io.BytesIO()
    sf.write(buffer, full_audio, SAMPLE_RATE, format="WAV")
    return buffer.getvalue()


def play(path: str) -> None:
    """Play a .wav file using the current OS's default audio playback."""
    system = platform.system()
    if system == "Windows":
        import winsound
        winsound.PlaySound(path, winsound.SND_FILENAME)
    elif system == "Darwin":  # macOS
        os.system(f"afplay {path}")
    else:  # Linux
        os.system(f"aplay {path}")


def speak(text: str, voice: str = DEFAULT_VOICE) -> None:
    """Convert text to speech using Kokoro and play it out loud (CLI use)."""
    full_audio = _render(text, voice)
    if full_audio is None:
        return

    sf.write(OUTPUT_FILE, full_audio, SAMPLE_RATE)

    play(OUTPUT_FILE)
