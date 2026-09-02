import { Graph, NOTHING } from "../graph.ts";
import { renderData, snapshot } from "../view.ts";

const g = new Graph();

g.def("firstName", s => (s.includes(",") ? s.split(", ")[1] : s.split(" ")[0]));
g.def("lastName",  s => (s.includes(",") ? s.split(", ")[0] : s.split(" ")[1]));
for (const raw of ["robert smith", "smith, robert",
                   "alice brown",  "brown, alice"]) {
  g.node(raw).apply("firstName");
  g.node(raw).apply("lastName");
}

g.def("headerLine", c => c.split("\n")[0]);
g.def("dataRow",   (c, n) => c.split("\n")[+n] ?? null);

const csv = "first,last\ncarol,white\ndave,green";
g.node(csv);

const cols = g.node(csv).apply("headerLine").value.split(",");

cols.forEach((name, i) => g.def(name, row => row.split(",")[i] ?? null));

for (let i = 1; ; i++) {
  const row = g.node(csv).apply("dataRow", String(i));
  if (row.value === NOTHING) break;
  for (const name of cols) row.apply(name);
}

g.def("ip",   s => s.split(":")[0]);
g.def("port", s => s.split(":")[1]);
for (const ep of ["192.168.1.10:8080", "192.168.1.10:443", "10.0.0.5:22"]) {
  g.node(ep).apply("ip");
  g.node(ep).apply("port");
}

const before = snapshot(g);
const rows = g.node(csv).chop("dataRow", 1);
for (const name of cols) rows.apply(name);
const after = snapshot(g);

console.log("\n=== METHOD 4: the same CSV, via chop() ===");
console.log("   rows found: " + rows.values.join("  |  "));
console.log("   nodes " + before.nodes.length + " -> " + after.nodes.length +
            "   edges " + before.edges.length + " -> " + after.edges.length +
            (before.nodes.length === after.nodes.length &&
             before.edges.length === after.edges.length ? "   (nothing new: faithful)" : "   (GREW — not faithful)"));

renderData(g);
