"""Entry point: runs the chat loop in either text or voice mode."""

import os
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_HUB_VERBOSITY"] = "error"

from memory.memory_manager import MemoryManager
from sentiment.sentiment_analyzer import SentimentAnalyzer
from llm.ollama_client import OllamaClient
from prompt.prompt_builder import PromptBuilder

memory = MemoryManager()
sentiment = SentimentAnalyzer()
llm = OllamaClient()
prompt_builder = PromptBuilder()

print("Chatbot with Memory.")
mode = input("Choose mode -- [1] Text  [2] Voice: ").strip()
voice_mode = mode == "2"

if voice_mode:
    # Imported only when needed so text mode doesn't require the
    # heavier TTS/STT dependencies to be installed correctly.
    from voice.tts import speak, VOICES
    from voice.stt import listen

    voice_choice = input("Choose voice -- [1] Male  [2] Female  [3] Robot: ").strip()
    voice_map = {"1": VOICES["male"], "2": VOICES["female"], "3": VOICES["robot"]}
    selected_voice = voice_map.get(voice_choice, VOICES["male"])

    print("Voice mode. Say 'exit' to quit.")
else:
    print("Text mode. Type 'exit' to quit.")

while True:
    if voice_mode:
        user_input = listen()
        print("🧑 You:", user_input)
    else:
        user_input = input("🧑 You: ")

    if user_input.lower() in ["exit", "quit"]:
        break

    sentiment_label = sentiment.analyze(user_input)

    memory.process_user_message(user_input)

    memories = memory.retrieve_relevant_memories(user_input)

    messages = prompt_builder.build_prompt(
        sentiment_label,
        memories,
        memory.get_recent_messages(),
        user_input,
        voice_mode=voice_mode
    )

    response = llm.chat(messages)
    print("\n🤖 AI:", response, "\n")

    if voice_mode:
        speak(response, voice=selected_voice)

    memory.add_assistant_message(response)
