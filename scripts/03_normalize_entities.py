import json
import os
import ollama

print("Aktueller Ordner:", os.getcwd())
print("Datei gefunden:", os.path.exists("ontology/categories.json"))

# Kategorien laden
with open("ontology/categories.json", "r", encoding="utf-8") as file:
    categories = json.load(file)

input_folder = "data/processed/extracted"
output_folder = "data/processed/normalized"

os.makedirs(output_folder, exist_ok=True)

for filename in os.listdir(input_folder):

    if not filename.endswith(".json"):
        continue

    print("Normalisiere:", filename)

    with open(f"{input_folder}/{filename}", "r", encoding="utf-8") as file:
        data = json.load(file)

    # Nur Experiences normalisieren
    if data["is_experience"]:

        normalized = []

        for experience in data["experiences"]:

            prompt = f"""
Choose ONLY ONE category.

Categories:

{categories["experiences"]}

Experience:

{experience}

Return ONLY the category name.
"""

            response = ollama.chat(
                model="llama3.2:3b",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            normalized.append(
                response["message"]["content"].strip()
            )

        data["experiences"] = normalized

    with open(f"{output_folder}/{filename}", "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

print("Fertig!")