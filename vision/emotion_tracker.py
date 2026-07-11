"""Facial emotion classification setup (Hugging Face). Not yet wired into main.py."""

from transformers import pipeline

emotion_classifier = pipeline("image-classification", model="trpakov/vit-face-expression")
