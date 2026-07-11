"""Assembles the final message list sent to the LLM each turn."""

class PromptBuilder:
    """Builds the system prompt and message history passed to the LLM."""

    def build_prompt(self,sentiment,memories,history,user_input,voice_mode=False):
        """Return the full message list for one chat turn.

        Combines the detected sentiment and retrieved long-term memories
        into a system prompt, then appends the recent conversation history.
        When `voice_mode` is True, an extra instruction is added asking the
        model to keep replies short, since long replies take longer to
        render through text-to-speech.
        """
        system_prompt = f'''
User sentiment: {sentiment}

Relevant memories:
{chr(10).join(memories)}
'''

        if voice_mode:
            system_prompt += '''
This is a spoken voice conversation. Keep replies short and conversational --
one or two sentences, like natural spoken dialogue, not a written essay.
'''

        messages = [
            {"role":"system","content":system_prompt}
        ]

        messages.extend(history)

        return messages
