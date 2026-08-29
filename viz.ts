// viz.ts — write the graph's data to data.js for the stable graph.html shell to
// draw. viz generates DATA only; graph.html is a hand-written shell you keep.
//
//   import { renderData } from "./viz.ts";
//   renderData(g);                     // writes ReversibleFunctionGraph2/data.js
//
// then open ReversibleFunctionGraph2/graph.html in a browser (reload after runs).
//
// The one v2 twist: edges are UNLABELED, so meaning shows through node ROLE
// instead. Each node gets a role read from its string — the shell colors by it,
// making the reification visible: functions and applications are nodes too.

import { writeFileSync } from "node:fs";
import type { Graph } from "./graph.ts";

// Role read from a node's string form (see spec: role comes from structure).
//   "upper()"        -> function   (empty parens: a function Value)
//   "upper(paris)"   -> application (parens with args: one determinate call)
//   "paris" / "5"    -> value       (a bare datum)
function roleOf(value: string): "value" | "function" | "application" {
  if (/^[^()]+\(\)$/.test(value)) return "function";
  if (/^[^()]+\(.+\)$/.test(value)) return "application";
  return "value";
}

// Snapshot the graph and write it as data.js, which sets window.GRAPH.
function renderData(g: Graph, path = "ReversibleFunctionGraph2/data.js"): void {
  const { nodes, edges } = g.snapshot();
  const graph = {
    nodes: nodes.map(value => ({ id: value, label: value, role: roleOf(value) })),
    edges: edges.map(e => ({ from: e.from, to: e.to })), // unlabeled: direction only
  };
  writeFileSync(path, `window.GRAPH = ${JSON.stringify(graph)};\n`);
  console.log(`rendered ${nodes.length} nodes, ${edges.length} edges -> ${path}`);
}

export { renderData };
