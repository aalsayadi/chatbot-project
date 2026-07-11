"""Client for the local Ollama LLM, accessed via its OpenAI-compatible API."""

from openai import OpenAI

class OllamaClient:
    """Thin wrapper around a local Ollama model for chat and memory extraction."""

    def __init__(self):
        self.client = OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        )

    def chat(self, messages):
        """Return the model's reply to the given message history."""
        response = self.client.chat.completions.create(
            model="llama3.1",
            messages=messages
        )
        return response.choices[0].message.content

    def extract_memory(self, text):
        """Ask the model to extract long-term facts from `text` as JSON.

        Returns the raw model output; the caller is responsible for
        parsing/validating it as JSON.
        """
        prompt = '''
Extract long-term user facts.
Return ONLY valid JSON:
{"memories":["fact1","fact2"]}
'''
        response = self.client.chat.completions.create(
            model="llama3.1",
            messages=[
                {"role":"system","content":prompt},
                {"role":"user","content":text}
            ]
        )
        return response.choices[0].message.content
