// play-path.ts — paths between fields, across TWO CONFLICTING formats.
//   npx tsx ReversibleFunctionGraph2/play-path.ts
//
// The raw string is the record. Different sources write it differently:
//   Format A  "First Last"   ->  "robert smith"
//   Format B  "Last, First"  ->  "smith, robert"   (order REVERSED — conflicting)
//
// firstName/lastName each detect the format and normalize. So both raws carve
// out the SAME field values — and because values dedup, "robert" from format A
// and "robert" from format B are ONE node. The two records meet at that node.
//
//   "robert smith"                 "smith, robert"
//        │      │                      │      │
//        ▼      ▼                      ▼      ▼
//   firstName  lastName          lastName  firstName
//        │      │                      │      │
//        ▼      ▼                      ▼      ▼
//     robert  smith  ◀── same nodes ──▶ smith  robert
//
// So robert → smith now has TWO paths — one per format. Multiple explanations.

import { Graph, Node, Tree } from "./graph.ts";
import { renderData } from "./viz.ts";

const g = new Graph();
// ONE function per field, but it interprets EITHER format (comma ⇒ Last, First).
g.def("firstName", s => (s.includes(",") ? s.split(", ")[1] : s.split(" ")[0]));
g.def("lastName",  s => (s.includes(",") ? s.split(", ")[0] : s.split(" ")[1]));

// Format A — "First Last"
for (const raw of ["robert smith", "alice brown", "carol white"]) {
  g.node(raw).apply("firstName");
  g.node(raw).apply("lastName");
}
// Format B — "Last, First"  (robert & alice also appear here; carol does not)
for (const raw of ["smith, robert", "brown, alice"]) {
  g.node(raw).apply("firstName");
  g.node(raw).apply("lastName");
}

// helper: the direct Nodes of a one-level from()/to() Tree
const nodes = (t: Tree): Node[] => t.items.filter((x): x is Node => x instanceof Node);

// ---- generalized sibling walk: ALL V-paths from `start` to `end` ----------
// climb UP to each raw that produced `start`, then DOWN every other branch,
// collecting the ones that land on `end`. Same two rules as before:
//   skip the function node on the way up; don't backtrack at the apex.
function siblingPaths(startVal: string, endVal: string): Node[][] {
  const start = g.node(startVal);
  const paths: Node[][] = [];
  for (const app1 of nodes(start.from()))                    // apps that produced start
    for (const raw of nodes(app1.from())) {                  // inputs of app1...
      if (raw.value.endsWith("()")) continue;                // ...skip the function node
      for (const app2 of nodes(raw.to())) {                  // other branches off the raw
        if (app2 === app1) continue;                         // don't backtrack at the apex
        for (const out of nodes(app2.to()))                  // what those produced
          if (out.value === endVal) paths.push([start, app1, raw, app2, out]);
      }
    }
  return paths;
}

const showPaths = (a: string, b: string) => {
  const ps = siblingPaths(a, b);
  console.log(`\n${a} → ${b}:  ${ps.length} path(s)`);
  for (const p of ps) console.log("   " + p.map(n => n.value).join("  →  "));
};

// ---- the same field value is produced by BOTH formats (deduped into one) ---
console.log("=== robert is produced by BOTH formats — one node, two producers ===");
g.node("robert").from().log("robert produced by =");
//  -> [firstName(robert smith), firstName(smith, robert)]

// ---- paths: one per format where the person exists in both -----------------
console.log("\n=== paths between fields — MULTIPLE explanations ===");
showPaths("robert", "smith");   // 2 paths (format A and format B)
showPaths("alice", "brown");    // 2 paths
showPaths("carol", "white");    // 1 path  (carol only appears in format A)

renderData(g);
