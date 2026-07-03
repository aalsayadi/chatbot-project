class PromptBuilder:
    def build_prompt(self,sentiment,memories,history,user_input):

        system_prompt = f'''
User sentiment: {sentiment}

Relevant memories:
{chr(10).join(memories)}
'''

        messages = [
            {"role":"system","content":system_prompt}
        ]

        messages.extend(history)

        return messages
