"""Ranks stored memories by semantic similarity to the current query."""

from sentence_transformers import SentenceTransformer
import numpy as np

class MemoryRetriever:
    """Retrieves the most relevant stored memories using embedding similarity."""

    def __init__(self):
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

    def retrieve(self, query, memories, top_k=5):
        """Return up to `top_k` memories most similar to `query`.

        Similarity is cosine similarity between sentence embeddings;
        results are ordered from most to least relevant.
        """
        if not memories:
            return []

        query_emb = self.model.encode(query)

        mem_embs = self.model.encode(memories)

        scores = np.dot(mem_embs, query_emb) / (
            np.linalg.norm(mem_embs, axis=1) *
            np.linalg.norm(query_emb)
        )

        idx = np.argsort(scores)[::-1][:top_k]

        return [memories[i] for i in idx]
