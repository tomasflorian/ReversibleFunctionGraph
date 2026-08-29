// play-path.ts — two ways to ingest people, and why they DON'T converge.
//   npx tsx ReversibleFunctionGraph2/scenarios/path.ts
//
// Method 1 (old): I hardcode firstName/lastName and apply them. The field lands
//   under firstName() because *I* named it that.
// Method 2 (CSV): the raw CSV is ONE string node. I chop it — header row, then
//   data rows, then cells — and the COLUMN NAMES COME FROM THE HEADER (data).
//   So a header of "first,last" makes the fields land under first()/last().
//
// firstName() and first() are different nodes, so the two methods do NOT merge.
// That's correct: nothing says "first" means "firstName". If the CSV header had
// said "firstName", they'd converge — but the DATA decides that, not the code.
// Non-convergence is the same mechanism as any two non-colliding strings.

import { Graph, Node, Tree, NOTHING } from "../graph.ts";
import { renderData } from "../viz.ts";

const g = new Graph();
const nodes = (t: Tree): Node[] => t.items.filter((x): x is Node => x instanceof Node);
const membersOf = (fn: string): string[] => g.node(fn + "()").to().to().flatten().values;

// ============ METHOD 1: OLD — hardcoded functions, two raw formats ==========
g.def("firstName", s => (s.includes(",") ? s.split(", ")[1] : s.split(" ")[0]));
g.def("lastName",  s => (s.includes(",") ? s.split(", ")[0] : s.split(" ")[1]));
for (const raw of ["robert smith", "smith, robert",   // robert, two formats
                   "alice brown",  "brown, alice"]) {  // alice,  two formats
  g.node(raw).apply("firstName");
  g.node(raw).apply("lastName");
}

// ============ METHOD 2: CSV — raw stays a STRING, chop from there ============
// The whole CSV is one node. These chop it (and leave the lineage behind):
g.def("headerLine", c => c.split("\n")[0]);
g.def("dataRow",   (c, n) => c.split("\n")[+n] ?? null);   // null past the end -> NOTHING

const csv = "first,last\ncarol,white\ndave,green";          // <-- header is DATA
g.node(csv);                                                // the raw CSV, as one node

// read the header to learn the column names — they come from the data
const cols = g.node(csv).apply("headerLine").value.split(",");   // ["first", "last"]

// DYNAMICALLY define a field function per column, named by the header, by position
cols.forEach((name, i) => g.def(name, row => row.split(",")[i] ?? null));

// chop each data row out of the CSV, then each cell out of the row
for (let i = 1; ; i++) {
  const row = g.node(csv).apply("dataRow", String(i));
  if (row.value === NOTHING) break;                         // ran out of rows
  for (const name of cols) row.apply(name);                 // apply the header-named functions
}

// ============ METHOD 3: NETWORK ENDPOINTS — a fourth record type ============
g.def("ip",   s => s.split(":")[0]);
g.def("port", s => s.split(":")[1]);
for (const ep of ["192.168.1.10:8080", "192.168.1.10:443", "10.0.0.5:22"]) {
  g.node(ep).apply("ip");
  g.node(ep).apply("port");
}

// ============ #1 — the ingestion methods land under DIFFERENT type nodes =====
console.log("=== fields do NOT converge — the header named them ===");
console.log("  firstName() (old, hardcoded) ->", membersOf("firstName"));
console.log("  lastName()  (old, hardcoded) ->", membersOf("lastName"));
console.log("  first()     (from CSV header)->", membersOf("first"));
console.log("  last()      (from CSV header)->", membersOf("last"));
console.log("  ip()        (endpoints)      ->", membersOf("ip"));
console.log("  port()      (endpoints)      ->", membersOf("port"));
console.log("  -> firstName() != first(): different strings, no merge. The DATA named it.");

// ============ #2 — provenance: trace any field back to its ultimate raw ======
function rootRaw(v: string): string {
  let cur = g.node(v);
  for (;;) {
    const up = nodes(cur.from()).filter(n => !n.value.endsWith("()"));
    if (up.length === 0) return cur.value;
    cur = up[0];
  }
}
console.log("\n=== provenance is free — every field knows its ultimate raw ===");
console.log("  carol  <- root:", JSON.stringify(rootRaw("carol")));   // the whole CSV blob
console.log("  robert <- root:", JSON.stringify(rootRaw("robert")));  // a typed name string

// ============ #3 — sibling paths inside a record =============================
function siblingPaths(startVal: string, endVal: string): Node[][] {
  const start = g.node(startVal);
  const paths: Node[][] = [];
  for (const app1 of nodes(start.from()))
    for (const raw of nodes(app1.from())) {
      if (raw.value.endsWith("()")) continue;                // skip the function node
      for (const app2 of nodes(raw.to())) {
        if (app2 === app1) continue;                         // don't backtrack at the apex
        for (const out of nodes(app2.to()))
          if (out.value === endVal) paths.push([start, app1, raw, app2, out]);
      }
    }
  return paths;
}
const showPaths = (a: string, b: string) => {
  const ps = siblingPaths(a, b);
  console.log(`\n${a} -> ${b}:  ${ps.length} path(s)`);
  for (const p of ps) console.log("   " + p.map(n => n.value).join("  ->  "));
};

console.log("\n=== paths, per method ===");
showPaths("robert", "smith");   // 2 — old method, both raw formats
showPaths("carol", "white");    // 1 — CSV, through its one row

renderData(g);
