"""Classifies the sentiment of user messages."""

from transformers import pipeline

class SentimentAnalyzer:
    """Wraps a pretrained DistilBERT sentiment-classification pipeline."""

    def __init__(self):
        self.pipeline = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english"
        )

    def analyze(self, text):
        """Return the predicted sentiment label ("POSITIVE"/"NEGATIVE") for `text`."""
        return self.pipeline(text)[0]["label"]
