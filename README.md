# Care Companion — Chatbot with Memory, Voice, and a 3D Avatar

A conversational assistant that runs fully locally. It combines a Python chat
backend (local LLM, long-term memory, sentiment) with a React web UI and a
Three.js / VRM 3D avatar that reacts to the conversation. It can be used two
ways:

- **Web app** — a browser chat UI with a live 3D avatar, text-to-speech, and
  cross-browser voice input.
- **CLI** — the original terminal chat loop (`main.py`), text or voice.

Both share the same backend logic (LLM, memory, sentiment, prompt building,
TTS, and speech-to-text).

> Includes an interactive **knowledge graph** built from a social-media dataset
> (see the [Knowledge graph](#knowledge-graph) section).

## Features

- **Local LLM** via [Ollama](https://ollama.com) (`llama3.1`) — no API key or
  internet needed at runtime.
- **Long-term memory** (SQLite) + short-term conversation history.
- **Sentiment analysis** of each message, mapped to avatar emotion.
- **3D VRM avatar** that animates with the conversation: `idle`, `listening`,
  `thinking`, `speaking`, plus emotion expressions and lip-sync.
- **Personas** — Male / Female / Robot, each pairing a distinct avatar model
  **and** a distinct TTS voice, switched together.
- **Text-to-speech** (Kokoro), played in the browser; a speaker icon on each
  reply plays it on demand in text mode.
- **Cross-browser voice input** (Chrome, Firefox, Safari, Edge): the browser
  streams microphone audio to the backend, which uses **Silero VAD** for
  end-of-speech detection and **faster-whisper** for transcription.
- **Automatic conversation saving** with LLM-generated titles.
- **Knowledge graph** — an interactive graph (Cosmograph) of concepts
  (Communities / Experiences / Emotions) built from a social-media dataset;
  click a node to see its source posts. Opened from the sidebar.

## Architecture

```
                         ┌──────────────────────────────┐
   Browser (React UI) ───┤ FastAPI server (server.py)    │
   ui/  + 3D avatar      │  POST /chat     chat pipeline  │──▶ Ollama (llama3.1)
     │  ▲                │  POST /tts      Kokoro TTS     │
     │  │ HTTP + WS      │  POST /title    title via LLM  │
     ▼  │                │  WS  /ws/transcribe  STT       │──▶ faster-whisper
   mic audio ───────────▶│    Silero VAD + faster-whisper │    + Silero VAD
                         └──────────────────────────────┘
   CLI (main.py) ─────────── same pipeline modules ───────────┘
```

The web UI (Vite) proxies `/api/*` and `/ws/*` to the FastAPI server, so the
frontend uses relative URLs and there is no CORS setup in development.

## Project structure

```
server.py                     # FastAPI web server wrapping the chat pipeline
main.py                       # CLI entry point (text or voice mode)
llm/ollama_client.py          # talks to the local Ollama model
memory/                       # long-term (SQLite) + short-term memory
sentiment/sentiment_analyzer.py
prompt/prompt_builder.py      # builds the prompt sent to the LLM
voice/tts.py                  # Kokoro TTS (synthesize bytes for web, speak for CLI)
voice/stt.py                  # faster-whisper transcription + Silero VAD (shared)
vision/                       # webcam face/emotion setup (not wired into the app)
requirements.txt

scripts/                      # knowledge-graph pipeline (01_prepare … 04_build_graph)
ontology/categories.json      # communities / experiences / emotions taxonomy
data/                         # KG dataset: raw, processed, and graph outputs

public/                       # static assets served at the web root
  *.vrm                       # the three avatar models (male/female/robot)
  vad-capture-worklet.js      # AudioWorklet that captures mic PCM
index.html                    # web app entry
vite.config.js                # Vite config + dev proxy (/api, /ws)
package.json
ui/src/
  App.jsx                     # the chat UI + voice/avatar orchestration
  api.js                      # calls to the backend
  voice/voiceSession.js       # mic capture + WebSocket streaming to /ws/transcribe
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
  access. Speak; when you pause, your speech is transcribed, the assistant
  replies aloud, and it listens again. Works in Chrome, Firefox, Safari, Edge.
- **Personas:** the Male / Female / Robot buttons swap both the avatar model
  and the voice.

The first voice request downloads the faster-whisper "base" model (~140 MB)
and the Silero VAD weights; subsequent runs are cached.

## Running the CLI

```bash
python main.py
```

Choose text or voice mode at the prompt. In voice mode, speech is captured
with Silero VAD endpointing and transcribed with faster-whisper. Type/say
`exit` or `quit` to end.

## Knowledge graph

Click **Knowledge Graph** in the web app's Options sidebar to open a full-screen
interactive graph of concepts — Communities, Experiences, and Emotions — with a
legend and a side panel. Clicking a node lists the source posts for that concept.

The graph is rendered from `public/nodes.csv`, `public/edges.csv`, and
`public/posts.json` using [Cosmograph](https://cosmograph.app/). Those files are
produced by the offline pipeline in `scripts/`, run in order (needs Ollama
running, plus `pandas` and `ollama` from `requirements.txt`):

```bash
python scripts/01_prepare_dataset.py     # clean the raw dataset
python scripts/02_extract_entities.py    # extract entities (via the LLM)
python scripts/03_normalize_entities.py  # normalize against ontology/categories.json
python scripts/04_build_graph.py         # emit data/graph/{nodes,edges,posts}
```

After rebuilding, copy the outputs into `public/` so the web app picks them up:

```bash
cp data/graph/nodes.csv data/graph/edges.csv data/graph/posts.json public/
```

## Backend API reference

| Endpoint            | Method | Purpose                                             |
| ------------------- | ------ | --------------------------------------------------- |
| `/health`           | GET    | Health check; lists available personas              |
| `/chat`             | POST   | Run one chat turn; returns reply, emotion, (audio)  |
| `/tts`              | POST   | Synthesize speech for a given text (on-demand)      |
| `/title`            | POST   | Generate a short conversation title                 |
| `/ws/transcribe`    | WS     | Stream mic audio → Silero VAD + faster-whisper → text |

Audio is only synthesized in `/chat` when the client asks for it (voice mode);
text mode uses `/tts` on demand, so it does no unnecessary TTS work.

## Known issues

- **Python 3.13 / 3.14:** `kokoro` (TTS), `faster-whisper`, `silero-vad`,
  `torch`, and `onnxruntime` may not have prebuilt wheels. Use **Python 3.12**.
- **Firefox voice input** relies on the streaming backend path (the Web Speech
  API is not used), so the backend must be running.
- **Vision features** (`vision/`) are set up but not wired into the app.

## Notes on repo layout

This repository was consolidated from three branches (backend, UI, avatar).
The integrated, runnable app lives here: the Python backend at the root and
the web UI under `ui/`, with avatar assets in `public/`.
