// path.ts — two ways to ingest people. The NAMES stay apart; the VALUES fuse.
//   npx tsx scenarios/path.ts
//
// Method 1 (old): I hardcode firstName/lastName and apply them. The field lands
//   under firstName() because *I* named it that.
// Method 2 (CSV): the raw CSV is ONE string node. I chop it — header row, then
//   data rows, then cells — and the COLUMN NAMES COME FROM THE HEADER (data).
//   So a header of "first,last" makes the fields land under first()/last().
//
// The FUNCTIONS do not merge: firstName() and first() are different nodes, so
// the two methods stay two columns. Nothing says "first" means "firstName" — if
// the CSV header had said "firstName" they would share a column, but the DATA
// decides that, not the code.
//
// The VALUES merge completely, and that is the point of the picture:
//     who produced "robert"?
//         [firstName(robert smith), firstName(smith, robert), first(robert,smith)]
// Three routes in — two spellings of a name and a row of a CSV file — one node.
// No schema, no key, no join declared: dedup did entity resolution for free.
//
// So the graph is ONE island holding THREE tables ([firstName|lastName],
// [first|last], [headerLine|dataRow]) plus a second island for ip/port that
// touches nothing. Islands are not tables: an island means values are SHARED,
// a table means shapes MATCH. Two tables inside one island IS the join.

import { Graph, NOTHING } from "../graph.ts";
import { renderData } from "../view.ts";

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

renderData(g);
