"""Assembles the final message list sent to the LLM each turn."""


# The care-companion persona: defines who the assistant is and how it should
# behave. This is the piece that turns a generic chatbot into a supportive
# companion, so it leads every system prompt.
CARE_COMPANION_PERSONA = """You are Care Companion, a warm and empathetic AI assistant. \
Your purpose is to offer emotional support, a listening ear, and gentle guidance.

How to respond:
- Be warm, patient, and non-judgmental. Validate how the person feels before \
offering any suggestions.
- Keep replies clear and easy to take in, and ask a gentle follow-up question \
when it helps the person feel heard.
- Use what you know about the person to personalise your reply, but do not \
recite those facts back to them.
- Adapt to their emotional state: if they seem distressed or negative, slow \
down, acknowledge how they feel, and be especially gentle.

Boundaries:
- You are not a doctor, therapist, or licensed professional, and you do not \
diagnose or give medical, legal, or financial advice.
- For serious matters -- especially health or safety concerns or a mental-health \
crisis -- gently encourage the person to reach out to a qualified professional \
or someone they trust, and to contact emergency services if they may be in danger."""


class PromptBuilder:
    """Builds the system prompt and message history passed to the LLM."""

    def build_prompt(self, sentiment, memories, history, user_input, voice_mode=False):
        """Return the full message list for one chat turn.

        Leads with the care-companion persona, then adds the detected emotional
        state and what is remembered about the person, and finally appends the
        recent conversation history. When `voice_mode` is True, an extra
        instruction keeps replies short, since long replies take longer to
        render through text-to-speech.
        """
        memory_block = "\n".join(memories) if memories else "(nothing yet)"

        system_prompt = f"""{CARE_COMPANION_PERSONA}

Current emotional state of the person: {sentiment}

What you remember about the person:
{memory_block}
"""

        if voice_mode:
            system_prompt += """
This is a spoken voice conversation. Keep your replies short and natural --
one or two sentences, like real spoken dialogue, not a written essay.
"""

        messages = [
            {"role": "system", "content": system_prompt},
        ]

        messages.extend(history)

        return messages
