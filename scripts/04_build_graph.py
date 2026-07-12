import json
import os
import pandas as pd

# Ordner

input_folder = "data/processed/normalized"
output_folder = "data/graph"

os.makedirs(output_folder, exist_ok=True)

# Speicher

nodes = []
edges = []
node_dict = {}
next_id = 1
posts = {}
experience_info = {}

# Experience Node anlegen

def add_experience(label):
    global next_id
    label = str(label)
    label = (
        label
        .replace("[", "")
        .replace("]", "")
        .replace("'", "")
        .strip()
    )

    if label not in node_dict:
        node_id = f"n{next_id}"
        node_dict[label] = node_id
        nodes.append({
            "id": node_id,
            "label": label,
            "type": "Experience"
        })
        next_id += 1
    return node_dict[label]

# Dateien lesen

for filename in os.listdir(input_folder):
    if not filename.endswith(".json"):
        continue
    with open(
        os.path.join(input_folder, filename),
        "r",
        encoding="utf-8"
    ) as file:
        data = json.load(file)
    if not data["is_experience"]:
        continue
    for experience in data["experiences"]:
        node_id = add_experience(experience)

        # Posts speichern

        if experience not in posts:
            posts[experience] = []
        posts[experience].append({
            "post_id": data["post_id"],
            "text": data["text"],
            "community": data["community"],
            "emotions": data["emotions"],
            "resources": data["resources"]
        })

        # Infos sammeln

        if experience not in experience_info:
            experience_info[experience] = {
                "communities": set(),
                "emotions": set()
            }

        experience_info[experience]["communities"].update(
            data["community"]
        )

        experience_info[experience]["emotions"].update(
            data["emotions"]
        )

# Experience-Experience Links

experiences = list(experience_info.keys())
for i in range(len(experiences)):
    for j in range(i + 1, len(experiences)):
        e1 = experiences[i]
        e2 = experiences[j]
        common_communities = (
            experience_info[e1]["communities"]
            &
            experience_info[e2]["communities"]
        )

        common_emotions = (
            experience_info[e1]["emotions"]
            &
            experience_info[e2]["emotions"]
        )
        if common_communities or common_emotions:
            edges.append({
                "source": node_dict[e1],
                "target": node_dict[e2],
                "relationship": "similar"
            })

# CSV schreiben

pd.DataFrame(nodes).to_csv(
    os.path.join(output_folder, "nodes.csv"),
    index=False
)

pd.DataFrame(edges).to_csv(
    os.path.join(output_folder, "edges.csv"),
    index=False
)

# posts.json schreiben

with open(
    os.path.join(output_folder, "posts.json"),
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        posts,
        file,
        indent=2,
        ensure_ascii=False
    )

print("Knowledge Graph erstellt.")