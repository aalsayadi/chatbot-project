from transformers import pipeline

class SentimentAnalyzer:
    def __init__(self):
        self.pipeline = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english"
        )

    def analyze(self, text):
        return self.pipeline(text)[0]["label"]
