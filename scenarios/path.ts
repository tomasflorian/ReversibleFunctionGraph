// path.ts — two ways to ingest people, and why they DON'T converge.
//   npx tsx scenarios/path.ts
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
// Non-convergence is the same mechanism as any two non-colliding strings. In the
// picture they are literally two separate ISLANDS that share no node at all.
//
// Where dedup DOES bite is inside method 1, across two spellings of one name:
//     who produced "robert"?  [firstName(robert smith), firstName(smith, robert)]
// "robert smith" and "smith, robert" are different strings that were never
// related by anything, and both land on the same "robert". No key, no schema.
//
// The whole graph is 4 islands and 4 tables — but NOT one table per island.
// Island 1 (the CSV) holds two: [first|last] and [headerLine|dataRow]. Island 4
// is the lone "∅" node and holds none. An island means values are SHARED; a
// table means shapes MATCH. They are different questions.

import { Graph, NOTHING } from "../graph.ts";
import { renderData, snapshot } from "../view.ts";

const g = new Graph();

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

// ============ METHOD 4: THE SAME CSV, SAID ONCE ============================
// Method 2's row loop, one layer up. chop() IS the numbered cut, so the bare
// for(;;) with its sentinel break collapses to a line. Same function name, same
// CSV, same header-named columns — so if the sugar is faithful, every node it
// asks for ALREADY EXISTS and the graph does not grow by one. That is the
// project's litmus, run as a measurement instead of claimed in a comment.
const before = snapshot(g);
const rows = g.node(csv).chop("dataRow", 1);   // <- replaces the whole loop above
for (const name of cols) rows.apply(name);     // <- each header-named function
const after = snapshot(g);

console.log("\n=== METHOD 4: the same CSV, via chop() ===");
console.log("   rows found: " + rows.values.join("  |  "));
console.log("   nodes " + before.nodes.length + " -> " + after.nodes.length +
            "   edges " + before.edges.length + " -> " + after.edges.length +
            (before.nodes.length === after.nodes.length &&
             before.edges.length === after.edges.length ? "   (nothing new: faithful)" : "   (GREW — not faithful)"));

renderData(g);
