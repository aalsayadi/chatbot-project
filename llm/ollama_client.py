from openai import OpenAI

class OllamaClient:
    def __init__(self):
        self.client = OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        )

    def chat(self, messages):
        response = self.client.chat.completions.create(
            model="llama3.1",
            messages=messages
        )
        return response.choices[0].message.content

    def extract_memory(self, text):
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
