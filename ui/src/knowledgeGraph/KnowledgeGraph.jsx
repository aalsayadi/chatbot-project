import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Cosmograph, prepareCosmographData } from "@cosmograph/cosmograph";

// Node colours by ontology type (kept in sync with the legend below).
const NODE_COLORS = {
  Experience: "#0068ad",
  Community: "#ff69b4",
  Emotion: "#8e76ee",
};

async function loadCSV(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  const text = await response.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

/**
 * Renders the knowledge graph (nodes.csv / edges.csv) with Cosmograph, ported
 * from the teammate's standalone `src/main.js`. Clicking a node lists the
 * source posts for that concept from posts.json.
 */
export default function KnowledgeGraph() {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const postsByKeyRef = useRef({});
  const preparedPointsRef = useRef([]);
  const [selected, setSelected] = useState(null); // { label, posts: [...] }
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const rawPoints = await loadCSV("/nodes.csv");
        rawPoints.forEach((point) => {
          point.color = NODE_COLORS[point.type] || "#888888";
        });
        const rawLinks = await loadCSV("/edges.csv");

        // posts.json keys have stray surrounding whitespace; normalize them so
        // a clicked node's label can be matched reliably.
        try {
          const postsResponse = await fetch("/posts.json");
          if (postsResponse.ok) {
            const posts = await postsResponse.json();
            const map = {};
            for (const [key, value] of Object.entries(posts)) {
              map[key.trim().toLowerCase()] = value;
            }
            postsByKeyRef.current = map;
          }
        } catch {
          postsByKeyRef.current = {};
        }

        const dataConfig = {
          points: {
            pointIdBy: "id",
            pointLabelBy: "label",
            pointIncludeColumns: ["*"],
          },
          links: {
            linkSourceBy: "source",
            linkTargetsBy: ["target"],
          },
        };

        const { points, links, cosmographConfig } = await prepareCosmographData(
          dataConfig,
          rawPoints,
          rawLinks,
        );

        if (cancelled || !containerRef.current) {
          return;
        }
        preparedPointsRef.current = points;

        graphRef.current = new Cosmograph(containerRef.current, {
          points,
          links,
          ...cosmographConfig,
          showLabels: true,
          showHoveredPointLabel: true,
          pointColorBy: "type",
          onClick: (index) => {
            if (index === undefined || index === null) {
              setSelected(null);
              return;
            }
            const node =
              preparedPointsRef.current?.[index] ?? rawPoints?.[index];
            const label = (node?.label ?? node?.id ?? "").toString().trim();
            const relatedPosts =
              postsByKeyRef.current[label.toLowerCase()] || [];
            setSelected({ label, posts: relatedPosts });
          },
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Could not load the knowledge graph data.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        graphRef.current?.destroy?.();
      } catch {
        // ignore
      }
      graphRef.current = null;
    };
  }, []);

  return (
    <div className="kgLayout">
      <div className="kgLegend" aria-label="Legend">
        <div className="kgLegendItem">
          <span className="kgDot" style={{ background: NODE_COLORS.Experience }} />
          Experience
        </div>
        <div className="kgLegendItem">
          <span className="kgDot" style={{ background: NODE_COLORS.Community }} />
          Community
        </div>
        <div className="kgLegendItem">
          <span className="kgDot" style={{ background: NODE_COLORS.Emotion }} />
          Emotion
        </div>
      </div>

      <div className="kgCanvas" ref={containerRef} />

      <aside className="kgPanel" aria-label="Related posts">
        {error ? (
          <p className="kgPanelHint">{error}</p>
        ) : selected ? (
          <>
            <h3 className="kgPanelTitle">{selected.label}</h3>
            {selected.posts.length === 0 ? (
              <p className="kgPanelHint">No source posts for this concept.</p>
            ) : (
              <ul className="kgPostList">
                {selected.posts.map((post, i) => (
                  <li key={post.post_id ?? i} className="kgPostItem">
                    {post.text}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="kgPanelHint">Click a node to see related posts.</p>
        )}
      </aside>
    </div>
  );
}
