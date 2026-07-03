import sqlite3

class MemoryStore:
    def __init__(self, db_path="database/memories.db"):
        self.conn = sqlite3.connect(db_path)
        self.conn.execute('''
        CREATE TABLE IF NOT EXISTS memories(
            id INTEGER PRIMARY KEY,
            memory TEXT UNIQUE
        )
        ''')

    def save_memory(self, memory):
        try:
            self.conn.execute(
                "INSERT INTO memories(memory) VALUES(?)",
                (memory,)
            )
            self.conn.commit()
        except:
            pass

    def get_all_memories(self):
        cur = self.conn.cursor()
        cur.execute("SELECT memory FROM memories")
        return [row[0] for row in cur.fetchall()]
