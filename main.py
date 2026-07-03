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

print("Chatbot with Memory. Type exit to quit.")

while True:
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
        user_input
    )

    response = llm.chat(messages)
    print("\n🤖 AI:", response, "\n")

    memory.add_assistant_message(response)
