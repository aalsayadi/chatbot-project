import json
import os

import ollama
import pandas as pd

# Daten laden

posts = pd.read_csv("data/processed/posts.csv")
posts = posts.head(100)

with open("ontology/categories.json", "r", encoding="utf-8") as file:
    categories = json.load(file)

# Ausgabeordner anlegen
os.makedirs("data/processed/extracted", exist_ok=True)

# Alle Posts durchgehen

for _, post in posts.iterrows():

    post_id = str(post["id"])
    text = str(post["text"])

    print("Verarbeite:", post_id)

    prompt = f"""
You are extracting structured knowledge from Reddit/Twitter posts.

A lived experience is a first-person or clearly described personal experience,
challenge, barrier, support, or interaction.

Only use the categories from this ontology.

Communities:
{categories["communities"]}

Experiences:
{categories["experiences"]}

Resources:
{categories["resources"]}

Emotions:
{categories["emotions"]}

If the text is NOT a lived experience return ONLY:

{{
    "is_experience": false
}}

Otherwise return ONLY valid JSON:

{{
    "is_experience": true,
    "community": [],
    "experiences": [],
    "resources": [],
    "emotions": []
}}

Text:

{text}
"""

    # Ollama aufrufen

    response = ollama.chat(
        model="llama3.2:3b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    answer = response["message"]["content"].strip()

    # Sicherheitsantworten überspringen

    if (
        "I can't provide" in answer
        or "I cannot provide" in answer
        or "I'm sorry" in answer
    ):
        print("Übersprungen (Sicherheitsantwort)")
        continue

    # JSON einlesen

    try:
        result = json.loads(answer)

    except json.JSONDecodeError:
        print("Ungültiges JSON")
        continue

    # Nur Experiences speichern

    if not result["is_experience"]:
        continue

    result["post_id"] = post_id
    result["text"] = text

    # Datei speichern

    with open(
        f"data/processed/extracted/{post_id}.json",
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            result,
            file,
            indent=2,
            ensure_ascii=False
        )

print("Fertig!")