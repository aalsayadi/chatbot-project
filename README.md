# Care Companion — Chatbot with Memory, Voice, and a 3D Avatar

A conversational assistant that runs fully locally. It combines a Python chat
backend (local LLM, long-term memory, sentiment) with a React web UI and a
Three.js / VRM 3D avatar that reacts to the conversation. It can be used two
ways:

- **Web app** — a browser chat UI with a live 3D avatar, text-to-speech, and
  voice input.
- **CLI** — the original terminal chat loop (`main.py`), text or voice.

Both share the same backend logic (LLM, memory, sentiment, prompt building,
TTS, and speech-to-text).

## Features

- **Local LLM** via [Ollama](https://ollama.com) (`llama3.1`) — no API key or
  internet needed at runtime.
- **Streaming replies** — the answer appears token-by-token as it's generated.
- **Landing page** — a welcome screen with a "Start a Conversation" button that
  opens the chat.
- **Long-term memory** (SQLite) + short-term conversation history. Fact
  extraction runs in the background so it doesn't slow the reply.
- **Sentiment analysis** of each message, mapped to avatar emotion.
- **3D VRM avatar** that animates with the conversation: `idle`, `listening`,
  `thinking`, `speaking`, plus emotion expressions and lip-sync.
- **Personas** — **Felix**, **Lisa**, and **Atlas**, each pairing a distinct
  avatar model **and** a distinct TTS voice (and a profile picture), switched
  together.
- **Text-to-speech** (Kokoro), played in the browser; a speaker icon on each
  reply plays it on demand in text mode.
- **Voice input** in the browser via the built-in **Web Speech API**
  (Chrome, Edge, Safari; not Firefox). The CLI uses faster-whisper + Silero VAD.
- **Automatic conversation saving** with LLM-generated titles.
- **Knowledge graph** — an interactive Cosmograph view of concepts
  (Communities / Experiences / Emotions) built from a social-media dataset.

## Architecture

```
                         ┌──────────────────────────────┐
   Browser (React UI) ───┤ FastAPI server (server.py)    │
   ui/ + 3D avatar       │  POST /chat[/stream]  pipeline │──▶ Ollama (llama3.1)
   + Web Speech API STT  │  POST /tts      Kokoro TTS     │
     │  HTTP             │  POST /title    title via LLM  │
     ▼                   └──────────────────────────────┘
   (voice input is transcribed in the browser, then sent as text to /chat)

   CLI (main.py) ── same pipeline + faster-whisper/Silero VAD for its STT ──┘
```

The web UI (Vite) proxies `/api/*` to the FastAPI server, so the frontend uses
relative URLs and there is no CORS setup in development.

The **knowledge graph** is a frontend-only view: it reads prebuilt data
(`public/nodes.csv`, `edges.csv`, `posts.json`) and renders it in the browser,
so it doesn't touch the backend. That data is produced offline by the numbered
pipeline scripts in `scripts/`.

## Project structure

```
server.py                     # FastAPI web server wrapping the chat pipeline
main.py                       # CLI entry point (text or voice mode)
llm/ollama_client.py          # talks to the local Ollama model
memory/                       # long-term (SQLite) + short-term memory
sentiment/sentiment_analyzer.py
prompt/prompt_builder.py      # builds the prompt sent to the LLM
voice/tts.py                  # Kokoro TTS (synthesize bytes for web, speak for CLI)
voice/stt.py                  # faster-whisper + Silero VAD (CLI voice mode only)
vision/                       # webcam face/emotion setup (not wired into the app)
requirements.txt

scripts/                      # knowledge-graph pipeline (01_prepare … 04_build_graph)
ontology/categories.json      # communities / experiences / emotions taxonomy
data/                         # KG dataset: raw, processed, and graph outputs

public/                       # static assets served at the web root
  *.vrm                       # the three avatar models (male/female/robot)
  nodes.csv / edges.csv / posts.json   # knowledge-graph data
index.html                    # web app entry
vite.config.js                # Vite config + dev proxy (/api)
package.json
ui/src/
  App.jsx                     # the chat UI + voice/avatar orchestration
  api.js                      # calls to the backend
  avatar/                     # Three.js/VRM avatar module + persona map
  knowledgeGraph/             # Cosmograph knowledge-graph view
  styles.css
```

## Prerequisites

- **Python 3.11 or 3.12.** (Python 3.13/3.14 are not recommended — several
  voice/ML dependencies don't yet ship wheels for them. See
  [Known issues](#known-issues).)
- **[Ollama](https://ollama.com/download)** installed and running.
- **Node.js 18+** (for the web UI).
- A microphone and speakers for voice features.
- A modern browser — see below.

## Browser support

The web app runs in any modern browser (**Chrome, Edge, Firefox, Safari**) —
the chat, streaming replies, 3D avatar, TTS playback, and knowledge graph all
work everywhere.

The only feature with limited support is **voice input**, which uses the
browser's built-in Web Speech API: available in **Chrome, Edge, and Safari**,
but **not Firefox**. In Firefox everything else still works (type to chat, and
use the speaker icon to hear replies).

> [!TIP]
> **Recommended browser: Google Chrome** — most reliable Web Speech API and
> WebGL support, so voice input and the 3D avatar behave best there.

## Setup

### 1. Clone

```bash
git clone https://github.com/aalsayadi/chatbot-project.git
cd chatbot-project
```

### 2. Backend (Python)

Create a virtual environment with a supported Python and install deps:

macOS/Linux:

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Windows (PowerShell):

```powershell
py -3.12 -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Pull the model used by Ollama and make sure Ollama is running (it serves at
`http://localhost:11434`):

```bash
ollama pull llama3.1
```

### 3. Frontend (Node)

```bash
npm install
```

## Running the web app

Run the backend and the frontend in two terminals.

**Terminal 1 — backend** (from the project root, venv activated):

```bash
uvicorn server:app --port 8000
```

**Terminal 2 — frontend:**

```bash
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

- **Text mode:** type a message; the avatar reacts while the reply is
  generated. Click the speaker icon on a reply to hear it aloud.
- **Voice mode:** click the microphone under the avatar and allow microphone
  access. Speak; when you pause, your speech is transcribed (by the browser's
  Web Speech API), the assistant replies aloud, and it listens again. Works in
  Chrome, Edge, and Safari (Firefox has no Web Speech API).
- **Personas:** the Male / Female / Robot buttons swap both the avatar model
  and the voice.
- **Knowledge graph:** click **Knowledge Graph** in the Options sidebar to open
  the concept graph; click a node to see its source posts.

## Running the CLI

```bash
python main.py
```

Choose text or voice mode at the prompt. In voice mode, speech is captured
with Silero VAD endpointing and transcribed with faster-whisper. Type/say
`exit` or `quit` to end.

## Backend API reference

| Endpoint            | Method | Purpose                                             |
| ------------------- | ------ | --------------------------------------------------- |
| `/health`           | GET    | Health check; lists available personas              |
| `/chat`             | POST   | Run one chat turn; returns reply, emotion, (audio)  |
| `/chat/stream`      | POST   | Same as `/chat` but streams the reply token-by-token (NDJSON) |
| `/tts`              | POST   | Synthesize speech for a given text (on-demand)      |
| `/title`            | POST   | Generate a short conversation title                 |

The web UI uses `/chat/stream` so replies render as they generate. Audio is
only synthesized when the client asks for it (voice mode); text mode uses
`/tts` on demand, so it does no unnecessary TTS work. Long-term memory
extraction runs as a background task, off the reply's critical path.

## Changes since the previous version

- **Landing page** added — a welcome screen with a "Start a Conversation"
  button that opens the chat.
- **Personas renamed** to **Felix**, **Lisa**, and **Atlas**, each with a
  profile picture, plus avatar animation/tuning improvements.
- **Bigger avatar** — the avatar circle now fills the (wider) left panel.
- **Voice input reverted to the browser's Web Speech API.** The server-side
  streaming STT (WebSocket + faster-whisper + Silero VAD) was removed from the
  web app; the CLI still uses faster-whisper for its voice mode.
- **Knowledge graph restyled** to match the app theme (green graph area, purple
  side panels, larger legend) and given a click-a-node → source-posts panel.
- **Streaming replies** — the web app now uses `POST /chat/stream`, so answers
  render token-by-token instead of appearing all at once.
- **Background memory extraction** — the long-term fact-extraction LLM call now
  runs as a background task after the reply is sent, removing a second Ollama
  round-trip from every turn's wait.

## Known issues

- **Python 3.13 / 3.14:** `kokoro` (TTS), `faster-whisper`, `silero-vad`,
  `torch`, and `onnxruntime` may not have prebuilt wheels. Use **Python 3.12**.
- **Firefox** has no Web Speech API, so voice input isn't available there; text
  chat and the per-reply speaker icon still work.
- **Vision features** (`vision/`) are set up but not wired into the app.

## Notes on repo layout

This repository was consolidated from three branches (backend, UI, avatar).
The integrated, runnable app lives here: the Python backend at the root and
the web UI under `ui/`, with avatar assets in `public/`.
