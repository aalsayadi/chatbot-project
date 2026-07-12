import pandas as pd
from pathlib import Path

# Pfade
input_file = Path("data/raw/LGBT_Tweets_processed.csv")
output_file = Path("data/processed/posts.csv")

# CSV laden
df = pd.read_csv(input_file)

# Nur die Spalten auswählen, die wir brauchen
posts = df[["id", "tweet"]].copy()

# Spalten umbenennen
posts.rename(columns={"tweet": "text"}, inplace=True)

# Speichern
posts.to_csv(output_file, index=False)

print(f"{len(posts)} Posts gespeichert.")