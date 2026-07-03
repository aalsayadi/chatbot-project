import json


from memory.short_term_memory import ShortTermMemory
from memory.memory_store import MemoryStore
from memory.memory_retriever import MemoryRetriever
from llm.ollama_client import OllamaClient

class MemoryManager:
    def __init__(self):
        self.short_term = ShortTermMemory()
        self.store = MemoryStore()
        self.retriever = MemoryRetriever()
        self.llm = OllamaClient()

    def process_user_message(self,text):
        self.short_term.add("user",text)

        try:
            raw = self.llm.extract_memory(text)

            # For debugging, you can print the raw memory data
            print("\n=== RAW MEMORY EXTRACTION ===")
            print(raw)

            data = json.loads(raw)

            # For debugging, you can print the parsed memory data
            print("\n=== PARSED MEMORIES ===")
            print(data)

            for mem in data.get("memories",[]):
                # For debugging, you can print each memory before saving
                print("\n=== MEMORY TO SAVE ===")
                print(mem)

                self.store.save_memory(mem)

        except Exception as e:
            pass
        
    def add_assistant_message(self,text):
        self.short_term.add("assistant",text)

    def get_recent_messages(self):
        return self.short_term.get_messages()

    def retrieve_relevant_memories(self,query):
        memories = self.store.get_all_memories()
        return self.retriever.retrieve(query, memories)
