// view.ts — HOW DO I LOOK AT IT? Everything that turns the graph into an
// external picture: the whole-graph snapshot, and writing it as data.js for the
// stable graph.html shell to draw. view generates DATA only; graph.html is a
// hand-written shell you keep.
//
//   import { renderData } from "./view.ts";
//   renderData(g);                     // writes data.js beside this module
//
// then open graph.html in a browser (reload after runs).
//
// The one v2 twist: edges are UNLABELED, so meaning shows through node ROLE
// instead. Each node gets a role read from its string — the shell colors by it,
// making the reification visible: functions and applications are nodes too.

import { writeFileSync } from "node:fs";
import type { Graph } from "./graph.ts";

// Display role. value-vs-application is AUTHORITATIVE from the engine (no more
// guessing from the string — that's what mis-colored applications whose args
// contain newlines/parens). The function-vs-value split is purely cosmetic, so
// it's read from the safe empty-parens form "fn()".
function displayRole(value: string, role: "value" | "application"): "value" | "function" | "application" {
  if (role === "application") return "application";
  if (/^[^()]+\(\)$/.test(value)) return "function"; // "upper()" — safe, no args
  return "value";
}

// A plain read-only view of the WHOLE graph. Reads the kernel's raw accessors
// (all + outNodes) directly: display is the only thing that ever wants every
// node at once, which is why this lives here and not in the navigation layer.
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

// Snapshot the graph and write it as data.js, which sets window.GRAPH.
function renderData(g: Graph, path: string | URL = new URL("./data.js", import.meta.url)): void {
  const { nodes, edges } = snapshot(g);
  const graph = {
    nodes: nodes.map(n => ({ id: n.value, label: n.value, role: displayRole(n.value, n.role) })),
    edges: edges.map(e => ({ from: e.from, to: e.to })), // unlabeled: direction only
  };
  writeFileSync(path, `window.GRAPH = ${JSON.stringify(graph)};\n`);
  const shownPath = path instanceof URL ? "data.js" : path;
  console.log(`rendered ${nodes.length} nodes, ${edges.length} edges -> ${shownPath}`);
}

export { renderData, snapshot };
