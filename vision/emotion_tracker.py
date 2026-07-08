from transformers import pipeline

emotion_classifier = pipeline("image-classification", model="trpakov/vit-face-expression")
