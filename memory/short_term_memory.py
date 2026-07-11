"""Holds the recent conversation history used to build each prompt."""

class ShortTermMemory:
    """Fixed-size rolling buffer of recent chat messages."""

    def __init__(self,max_messages=20):
        self.messages=[]
        self.max_messages=max_messages

    def add(self,role,content):
        """Append a message and trim the buffer to `max_messages`."""
        self.messages.append({"role":role,"content":content})
        self.messages=self.messages[-self.max_messages:]

    def get_messages(self):
        """Return the current conversation history."""
        return self.messages
