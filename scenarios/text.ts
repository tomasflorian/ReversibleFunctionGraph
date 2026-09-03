import { Graph } from "../graph.ts";
import { relate } from "../relate.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { follow, back } = relate(g);

g.def("paragraph", (t, p) => t.split("\n\n").includes(p) ? p : null);
g.def("sentence",  (p, s) => p.split("\n").includes(s)   ? s : null);
g.def("word",      (s, w) => s.split(" ").includes(w)    ? w : null);

const text =
`paris is a city
the city is old

tokyo is a city
the city is new

a city is a place`;

for (const p of text.split("\n\n")) {
  g.node(text).apply("paragraph", p);
  for (const s of p.split("\n")) {
    g.node(p).apply("sentence", s);
    for (const w of s.split(" ")) g.node(s).apply("word", w);
  }
}

const oneLine = (s: string) => s.replace(/\n/g, " / ");
const uniq = (xs: string[]) => [...new Set(xs)];

console.log("=== THE CUT: a predicate, not a probe ===");
console.log("   the driver is the plain nested loop — no index, no chop:");
console.log("     for p of text.split(2 newlines) -> for s of p.split(newline) -> for w of s.split(space)");
console.log("   paragraphs:", follow(text, "paragraph").length);
console.log("   a non-member is silent:", g.node(text).apply("paragraph", "tokyo").value);

console.log("\n=== NOTHING SYNTHETIC: every argument was already a node ===");
const positions = g.all().filter(n => /^\d+$/.test(n.value));
console.log("   value nodes that are bare integers:", positions.length);
{
  const h = new Graph();
  h.def("paragraph", (t, i) => t.split("\n\n")[+i] ?? null);
  h.def("sentence",  (p, i) => p.split("\n")[+i]   ?? null);
  h.def("word",      (s, i) => s.split(" ")[+i]    ?? null);
  for (const p of h.node(text).chop("paragraph").nodes)
    for (const s of p.chop("sentence").nodes) s.chop("word");
  const mine = g.all().length, theirs = h.all().length;
  console.log("   nodes, content-keyed:", mine, " indexed:", theirs,
              " (" + (theirs - mine) + " of the indexed graph is bookkeeping)");
}

console.log("\n=== BACK TO THE SOURCE: unchanged, still four hops ===");
const w = "old";
for (const s of back(w, "word"))
  for (const p of back(s, "sentence"))
    for (const d of back(p, "paragraph")) {
      console.log('   word      "' + w + '"');
      console.log("   sentence  " + s);
      console.log("   paragraph " + oneLine(p));
      console.log("   document  " + oneLine(d));
    }

console.log("\n=== WHAT COLLAPSED, AND WHERE IT CAME BACK ===");
const sent = "a city is a place";
console.log("   sentence:", sent);
console.log('   "a" occurs twice, but the graph holds one fact:',
            g.node(sent).to().values.filter(v => v.endsWith(",a)")).length);
console.log("   words as a set:", uniq(follow(sent, "word")).join(" "));
console.log("   and the order is still right there in the container:");
console.log("     " + sent.split(" ").map((x, i) => i + ":" + x).join("  "));

console.log("\n=== THE PRICE: every piece is a 2-cycle ===");
const app = "word(" + sent + ",city)";
console.log("   " + app);
console.log("     inputs: " + g.node(app).from().values.join("  "));
console.log("     output: " + g.node(app).to().values.join("  "));
console.log('   so "city" is both an input and the output of one application.');
console.log("   and a one-sentence paragraph repeats its argument, so an edge is dropped:");
console.log("     sentence(" + sent + "," + sent + ") inputs: " +
            g.node("sentence(" + sent + "," + sent + ")").from().values.join("  "));

renderData(g);
