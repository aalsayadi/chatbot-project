# Knowledge-graph pipeline

These scripts build the knowledge-graph data (`nodes.csv`, `edges.csv`,
`posts.json`) from the raw dataset. The web app only reads the prebuilt outputs
in `public/`, so you only need this to regenerate the graph.

Requires Ollama running, plus `pandas` and `ollama` (both in
`../requirements.txt`). Run from the project root, in order:

```bash
python scripts/01_prepare_dataset.py     # clean the raw dataset
python scripts/02_extract_entities.py    # extract entities (via the LLM)
python scripts/03_normalize_entities.py  # normalize against ontology/categories.json
python scripts/04_build_graph.py         # emit data/graph/{nodes,edges,posts}
```

Then copy the outputs into `public/` so the web app picks them up:

```bash
cp data/graph/nodes.csv data/graph/edges.csv data/graph/posts.json public/
```
