import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData, snapshot } from "../view.ts";

const g = new Graph();
const { sequence } = shapes(g);

g.def("firstName", s => (s.includes(",") ? s.split(", ")[1] : s.split(" ")[0]));
g.def("lastName",  s => (s.includes(",") ? s.split(", ")[0] : s.split(" ")[1]));
for (const raw of ["robert smith", "smith, robert",
                   "alice brown",  "brown, alice"]) {
  g.node(raw).apply("firstName");
  g.node(raw).apply("lastName");
}

g.def("headerLine", c => c.split("\n")[0]);
const Rows = sequence("cutRows", "row", c => c.split("\n").slice(1));

const csv = "first,last\ncarol,white\ndave,green";
g.node(csv);

const cols = g.node(csv).apply("headerLine").value.split(",");

cols.forEach((name, i) => g.def(name, row => row.split(",")[i] ?? null));

const rowList = g.node(csv).apply("cutRows");
for (const r of rowList.value.split("|")) {
  const row = rowList.apply("row", r);
  for (const name of cols) row.apply(name);
}

g.def("ip",   s => s.split(":")[0]);
g.def("port", s => s.split(":")[1]);
for (const ep of ["192.168.1.10:8080", "192.168.1.10:443", "10.0.0.5:22"]) {
  g.node(ep).apply("ip");
  g.node(ep).apply("port");
}

const before = snapshot(g);
for (const r of Rows.of(csv)) for (const name of cols) r.apply(name);
const after = snapshot(g);

console.log("\n=== METHOD 4: the same CSV, via sequence() ===");
console.log("   rows found: " + Rows.of(csv).map(n => n.value).join("  |  "));
console.log("   nodes " + before.nodes.length + " -> " + after.nodes.length +
            "   edges " + before.edges.length + " -> " + after.edges.length +
            (before.nodes.length === after.nodes.length &&
             before.edges.length === after.edges.length ? "   (nothing new: faithful)" : "   (GREW — not faithful)"));

renderData(g);
