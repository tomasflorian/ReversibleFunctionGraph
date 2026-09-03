import { Graph } from "../graph.ts";
import { relate } from "../relate.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { back } = relate(g);
const { sequence } = shapes(g);

const paragraphs = sequence("cutParagraphs", t => t.split("\n\n"));
const sentences  = sequence("cutSentences",  p => p.split("\n"));
const words      = sequence("cutWords",      s => s.split(" "));

const text =
`paris is a city
the city is old

tokyo is a city
the city is new

a city is a place`;

for (const p of paragraphs.of(text))
  for (const s of sentences.of(p.value))
    words.of(s.value);

const oneLine = (s: string) => s.replace(/\n/g, " / ");

console.log("=== TWO STAGES: cut makes a list, digest breaks it up ===");
const sent = "paris is a city";
console.log("   sentence:", sent);
console.log("   cutWords ->", words.list(sent).value, "   (one application, one output)");
console.log("   digested ->", words.of(sent).map(n => n.value).join("  "));

console.log("\n=== DISCOVERY IS BACK: the driver splits nothing ===");
console.log("   for (const p of paragraphs.of(text))");
console.log("     for (const s of sentences.of(p.value))");
console.log("       words.of(s.value);");
console.log("   every part came off a list the graph computed, not off a JS split.");

console.log("\n=== ORDER IS NOW A NODE, not just recoverable ===");
console.log("   " + words.list("a city is a place").value);
console.log('   "a" is one value node, but the list keeps both of its positions.');

console.log("\n=== ONE UNIVERSAL element(), every level ===");
const digests = g.node("element()").to().nodes;
console.log("   extractions recorded:", digests.length);
console.log("   cut functions defined:", g.all().filter(n => /^cut\w+\(\)$/.test(n.value)).length);
console.log("   so 3 cuts + 1 element replace 3 membership predicates.");

console.log("\n=== BACK TO THE SOURCE: now through the list ===");
const w = "old";
for (const l of back(w, "element"))
  for (const s of back(l, "cutWords"))
    for (const l2 of back(s, "element"))
      for (const p of back(l2, "cutSentences")) {
        console.log('   word      "' + w + '"');
        console.log("   its list  " + l);
        console.log("   sentence  " + s);
        console.log("   paragraph " + oneLine(p));
      }

console.log("\n=== THE COST, MEASURED ===");
{
  const h = new Graph();
  h.def("paragraph", (t, p) => t.split("\n\n").includes(p) ? p : null);
  h.def("sentence",  (p, s) => p.split("\n").includes(s)   ? s : null);
  h.def("word",      (s, x) => s.split(" ").includes(x)    ? x : null);
  for (const p of text.split("\n\n")) {
    h.node(text).apply("paragraph", p);
    for (const s of p.split("\n")) {
      h.node(p).apply("sentence", s);
      for (const x of s.split(" ")) h.node(s).apply("word", x);
    }
  }
  console.log("   nodes, cut+digest:", g.all().length, " predicate-only:", h.all().length);
  console.log("   the extra nodes are the list values and the cut applications —");
  console.log("   that is what buys discovery and an explicit ordering.");
}

console.log("\n=== SELF-REFERENCE, where a cut yields one piece ===");
const lone = "a city is a place";
console.log("   cutSentences(" + lone + ") ->", sentences.list(lone).value);
console.log("   the list IS the input, so the cut application points back at its own argument.");

renderData(g);
