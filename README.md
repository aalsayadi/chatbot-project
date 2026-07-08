# Chatbot with Memory and Voice

A command-line chatbot with long-term memory, sentiment analysis, and (in-progress) webcam-based face/emotion detection and text-to-speech.

## Features

- Chats using a local LLM via [Ollama](https://ollama.com) (no API key or internet required at runtime)
- Remembers facts about the user across the conversation (long-term memory)
- Analyzes the sentiment of each message
- Speaks its replies out loud using local text-to-speech (Kokoro)
- Face detection setup in place (`vision/`), ready to be extended into emotion/gaze features

## Project structure

```
main.py                       # entry point, runs the chat loop
llm/ollama_client.py          # talks to the local Ollama model
memory/                       # long-term + short-term memory
sentiment/sentiment_analyzer.py
prompt/prompt_builder.py      # builds the final prompt sent to the LLM
vision/                       # webcam face + emotion detection (setup only so far)
voice/tts.py                  # text-to-speech (Kokoro)
requirements.txt
```

## Prerequisites

- **Python 3.10–3.13** (Python 3.14 currently breaks `kokoro`'s dependency chain — see [Known issues](#known-issues) below)
- **[Ollama](https://ollama.com/download)** installed and running
- A webcam and microphone/speakers, for the vision and voice features

## Setup

1. **Clone the repo**
   ```bash
   git clone https://https://github.com/aalsayadi/chatbot-project.git
   cd chatbot-project
   ```

2. **Create and activate a virtual environment**

   macOS/Linux:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

   Windows:
   ```powershell
   py -3.12 -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Pull the LLM model used by Ollama**
   ```bash
   ollama pull llama3.1
   ```
   Make sure Ollama is running (it usually starts automatically after install, serving at `http://localhost:11434`).

## Running it

```bash
python main.py
```

Type your messages at the `🧑 You:` prompt. Type `exit` or `quit` to end the conversation.

## Known issues

- **Python 3.14**: `kokoro` (text-to-speech) depends on `spacy`, which does not currently have published Python 3.14 wheels for some of its own dependencies. If `pip install -r requirements.txt` fails while building `blis`/`thinc`, use Python 3.12 in your virtual environment instead (see the Windows setup command above).
- **Webcam features** (`vision/`) are set up but not yet wired into the main chat loop.
