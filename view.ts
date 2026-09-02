import { writeFileSync } from "node:fs";
import type { Graph } from "./graph.ts";

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
  return {
    nodes: all.map(n => ({ value: n.value, role: n.roleName })),
    edges: all.flatMap(n => n.outNodes().map(to => ({ from: n.value, to: to.value }))),
  };
}

function renderData(g: Graph, path: string | URL = new URL("./data.js", import.meta.url)): void {
  const { nodes, edges } = snapshot(g);
  const graph = {
    nodes: nodes.map(n => ({ id: n.value, label: n.value, role: displayRole(n.value, n.role) })),
    edges: edges.map(e => ({ from: e.from, to: e.to })),
  };
  writeFileSync(path, `window.GRAPH = ${JSON.stringify(graph)};\n`);
  const shownPath = path instanceof URL ? "data.js" : path;
  console.log(`rendered ${nodes.length} nodes, ${edges.length} edges -> ${shownPath}`);
}

export { renderData, snapshot };
