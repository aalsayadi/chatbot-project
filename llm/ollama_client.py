"""Client for the local Ollama LLM, accessed via its OpenAI-compatible API."""

from openai import OpenAI

MODEL = "llama3.1"

# Ask Ollama to keep the model loaded in memory for this long after each
# request. This avoids the slow "cold start" (reloading the model) on the first
# message when the app has been idle for a while. Ollama's OpenAI-compatible
# endpoint reads this from the request body; older versions simply ignore it.
KEEP_ALIVE = "30m"


class OllamaClient:
    """Thin wrapper around a local Ollama model for chat and memory extraction."""

    def __init__(self):
        self.client = OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        )

    def chat(self, messages, temperature=None):
        """Return the model's reply to the given message history.

        `temperature=0` makes the model follow instructions more consistently
        (used for short, deterministic tasks like titling).
        """
        kwargs = {
            "model": MODEL,
            "messages": messages,
            "extra_body": {"keep_alive": KEEP_ALIVE},
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    def chat_stream(self, messages):
        """Yield the model's reply token-by-token as it is generated."""
        stream = self.client.chat.completions.create(
            model=MODEL,
            messages=messages,
            stream=True,
            extra_body={"keep_alive": KEEP_ALIVE},
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

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
            model=MODEL,
            messages=[
                {"role":"system","content":prompt},
                {"role":"user","content":text}
            ],
            extra_body={"keep_alive": KEEP_ALIVE},
        )
        return response.choices[0].message.content

    def warm_up(self):
        """Preload the model so the first real request isn't a cold start."""
        self.client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=1,
            extra_body={"keep_alive": KEEP_ALIVE},
        )
