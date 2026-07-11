"""Persists long-term memories to a local SQLite database."""

import os
import sqlite3

class MemoryStore:
    """SQLite-backed storage for long-term user facts."""

    def __init__(self, db_path="database/memories.db"):
        # Make sure the parent directory exists; sqlite3.connect will not
        # create it and would otherwise raise on a fresh checkout.
        parent = os.path.dirname(db_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

        # check_same_thread=False lets the single shared connection be used
        # from the web server's worker threads. Writes are funnelled through
        # save_memory (one insert at a time), so this stays safe in practice.
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.execute('''
        CREATE TABLE IF NOT EXISTS memories(
            id INTEGER PRIMARY KEY,
            memory TEXT UNIQUE
        )
        ''')

    def save_memory(self, memory):
        """Insert a memory, ignoring duplicates (memory column is UNIQUE)."""
        try:
            self.conn.execute(
                "INSERT INTO memories(memory) VALUES(?)",
                (memory,)
            )
            self.conn.commit()
        except:
            pass

    def get_all_memories(self):
        """Return every stored memory as a list of strings."""
        cur = self.conn.cursor()
        cur.execute("SELECT memory FROM memories")
        return [row[0] for row in cur.fetchall()]
