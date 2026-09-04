import { writeFileSync } from "node:fs";
import type { Graph } from "./graph.ts";
import { LENSES } from "./gaze.ts";

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function displayRole(value: string, role: "value" | "application"): "value" | "function" | "application" {
  if (role === "application") return "application";
  if (/^[^()]+\(\)$/.test(value)) return "function";
  return "value";
}

function snapshot(g: Graph): {
  nodes: { value: string; role: "value" | "application" }[];
  edges: { from: string; to: string }[];
} {
  const all = g.all();
  // CANONICAL ORDER. A graph is a set of nodes and a set of edges; insertion
  // order carries no meaning but would otherwise churn every snapshot when an
  // unrelated call moves. Sorting makes a diff line mean something changed.
  const nodes = all.map(n => ({ value: n.value, role: n.roleName }))
    .sort((a, b) => cmp(a.value, b.value));
  const edges = all.flatMap(n => n.outNodes().map(to => ({ from: n.value, to: to.value })))
    .sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));
  return { nodes, edges };
}

// One formatter for every section, so a new lens needs no formatting code.
// Leaf arrays go one entry to a line — that is what makes a snapshot diff
// readable — and nesting indents. nodes/edges/pivot/tables come out exactly as
// they did before this was generalised.
function pretty(v: unknown, indent = ""): string {
  if (Array.isArray(v))
    return v.length
      ? `[\n${v.map(x => indent + "  " + JSON.stringify(x)).join(",\n")}\n${indent}]`
      : "[]";
  if (v !== null && typeof v === "object")
    return `{\n${Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${indent}  ${JSON.stringify(k)}: ${pretty(val, indent + "  ")}`)
      .join(",\n")}\n${indent}}`;
  return JSON.stringify(v);
}

// Where the graph lands. Default: data.js, the scratch file the viewer reads.
// RFG_OUT redirects it — runAll.sh points each scenario at snapshots/<name>.js
// so a full run leaves the viewer's current graph alone.
const defaultOut = (): string | URL =>
  process.env.RFG_OUT ?? new URL("./data.js", import.meta.url);

function renderData(g: Graph, path: string | URL = defaultOut()): void {
  const { nodes, edges } = snapshot(g);
  const graph = {
    nodes: nodes.map(n => ({ id: n.value, label: n.value, role: displayRole(n.value, n.role) })),
    edges: edges.map(e => ({ from: e.from, to: e.to })),
    // Every reading gaze.ts offers, under its own name. Adding one there puts
    // it in data.js and in the snapshots without touching this file.
    ...Object.fromEntries(Object.entries(LENSES).map(([name, gaze]) => [name, gaze(g)])),
  };
  writeFileSync(path, `window.GRAPH = ${pretty(graph)};\n`);
  const shownPath = path instanceof URL ? "data.js" : path;
  console.log(`rendered ${nodes.length} nodes, ${edges.length} edges -> ${shownPath}`);
}

export { renderData, snapshot };
