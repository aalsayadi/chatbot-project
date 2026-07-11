"""Coordinates short-term conversation history and long-term memory extraction."""

import json


from memory.short_term_memory import ShortTermMemory
from memory.memory_store import MemoryStore
from memory.memory_retriever import MemoryRetriever
from llm.ollama_client import OllamaClient

class MemoryManager:
    """Combines recent conversation history with persisted long-term facts."""

    def __init__(self):
        self.short_term = ShortTermMemory()
        self.store = MemoryStore()
        self.retriever = MemoryRetriever()
        self.llm = OllamaClient()

    def process_user_message(self,text):
        """Record the message and extract any long-term facts it contains.

        Extraction failures (e.g. the LLM returning non-JSON output) are
        swallowed so a single bad response doesn't interrupt the conversation.
        """
        self.short_term.add("user",text)

        try:
            raw = self.llm.extract_memory(text)

            data = json.loads(raw)

            for mem in data.get("memories",[]):
                self.store.save_memory(mem)

        except Exception as e:
            pass
        
    def add_assistant_message(self,text):
        """Record the assistant's reply in short-term history."""
        self.short_term.add("assistant",text)

    def get_recent_messages(self):
        """Return the recent conversation history for prompt construction."""
        return self.short_term.get_messages()

    def retrieve_relevant_memories(self,query):
        """Return stored long-term memories most relevant to the given query."""
        memories = self.store.get_all_memories()
        return self.retriever.retrieve(query, memories)
