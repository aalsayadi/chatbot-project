class ShortTermMemory:
    def __init__(self,max_messages=20):
        self.messages=[]
        self.max_messages=max_messages

    def add(self,role,content):
        self.messages.append({"role":role,"content":content})
        self.messages=self.messages[-self.max_messages:]

    def get_messages(self):
        return self.messages
