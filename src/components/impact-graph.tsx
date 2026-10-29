"use client";
import { useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "./theme-toggle";
import { dependents } from "@/lib/graph-traversal";
import type { CodeGraph } from "@/lib/server/dependencies";
export default function ImpactGraph({
  graph,
  repositoryUrl,
  sha,
  onSelection,
}: {
  graph: CodeGraph;
  repositoryUrl: string;
  sha: string;
  onSelection?: (label: string) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [relation, setRelation] = useState("all"),
    [transitive, setTransitive] = useState(true),
    [collapsed, setCollapsed] = useState(false);
  const edges = graph.edges.filter(
    (e) => relation === "all" || e.kind === relation,
  );
  const affected = dependents(
    edges.filter((e) => e.kind !== "contains"),
    selected,
    transitive,
  );
  const visible = graph.nodes.filter(
    (n) =>
      (!search ||
        `${n.label} ${n.file}`.toLowerCase().includes(search.toLowerCase())) &&
      (!collapsed || !selected || affected.has(n.id)),
  );
  const ids = new Set(visible.map((n) => n.id));
  const nodes: Node[] = visible.map((n, i) => ({
    id: n.id,
    position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 105 },
    data: { label: `${n.kind}: ${n.label}` },
    style: {
      width: 230,
      background: "var(--surface2)",
      color: "var(--text)",
      border: `2px solid ${selected && affected.has(n.id) ? "#ac94e9" : "var(--line)"}`,
      borderRadius: 8,
      fontSize: 11,
    },
  }));
  const flowEdges: Edge[] = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({
      ...e,
      label: e.kind,
      animated: selected === e.target,
      style: { stroke: "#8e74d1" },
    }));
  const node = graph.nodes.find((n) => n.id === selected);
  return (
    <section aria-label="Code impact graph">
      <div className="forensic-controls">
        <label>
          Search nodes
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Relationship
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
          >
            <option value="all">All relationships</option>
            {[...new Set(graph.edges.map((e) => e.kind))].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="forensic-check">
          <input
            type="checkbox"
            checked={transitive}
            onChange={(e) => setTransitive(e.target.checked)}
          />
          Transitive dependents
        </label>
        <button
          className="forensic-action"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "Expand graph" : "Focus selected impact"}
        </button>
      </div>
      <p className="forensic-muted">
        Arrows: caller/importer → dependency. Purple outlines: selected node and
        its dependents. Static bindings are verified; behavioral effects remain
        predictions.
      </p>
      <div className="forensic-graph">
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          colorMode={theme}
          fitView
          nodesDraggable={false}
          onNodeClick={(_, n) => {
            setSelected(n.id);
            const selectedNode = graph.nodes.find((v) => v.id === n.id);
            if (selectedNode) onSelection?.(selectedNode.label.slice(0, 150));
          }}
          aria-label="Verified static dependencies"
        >
          <Background gap={22} />
          <Controls />
        </ReactFlow>
      </div>
      {!nodes.length && (
        <p>
          No supported nodes in this scope. Include JavaScript or TypeScript
          paths.
        </p>
      )}
      {node && (
        <div className="forensic-evidence">
          <h3>{node.label}</h3>
          <p>
            {node.file}:{node.line} · {affected.size - 1}{" "}
            {transitive ? "direct/transitive" : "direct"} dependent nodes
          </p>
          <a
            href={`${repositoryUrl}/blob/${sha}/${node.file.split("/").map(encodeURIComponent).join("/")}#L${node.line}`}
            target="_blank"
            rel="noreferrer"
          >
            Open source evidence ↗
          </a>
          <ul>
            {edges
              .filter((e) => e.source === selected || e.target === selected)
              .slice(0, 30)
              .map((e) => (
                <li key={e.id}>
                  {e.source} → {e.target} ({e.kind}, {e.file}:{e.line})
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
