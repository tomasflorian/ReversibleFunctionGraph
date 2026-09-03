import { Graph } from "../graph.ts";
import { relate } from "../relate.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { follow, back } = relate(g);

g.def("paragraph", (t, i) => t.split("\n\n")[+i] ?? null);
g.def("sentence",  (p, i) => p.split("\n")[+i]   ?? null);
g.def("word",      (s, i) => s.split(" ")[+i]    ?? null);

const text =
`paris is a city
the city is old

tokyo is a city
the city is new

a city is a place`;

const paragraphs = g.node(text).chop("paragraph").nodes;
const sentences: string[] = [];
const words: string[] = [];

for (const p of paragraphs)
  for (const s of p.chop("sentence").nodes) {
    sentences.push(s.value);
    for (const w of s.chop("word").nodes) words.push(w.value);
  }

const oneLine = (s: string) => s.replace(/\n/g, " / ");
const uniq = (xs: string[]) => [...new Set(xs)];

console.log("=== THE CUT: three levels, all by position ===");
console.log("   paragraphs:", paragraphs.length);
console.log("   sentences: ", sentences.length, "(" + uniq(sentences).length + " distinct)");
console.log("   words:     ", words.length, "(" + uniq(words).length + " distinct)");

console.log("\n=== FORWARD: a paragraph's sentences, in order ===");
for (const s of follow(paragraphs[0].value, "sentence")) console.log("   " + s);

console.log("\n=== BACK TO THE SOURCE: one word, up to the raw text ===");
const w = "old";
for (const s of back(w, "word")) {
  console.log('   word      "' + w + '"');
  console.log("   sentence  " + s);
  for (const p of back(s, "sentence")) {
    console.log("   paragraph " + oneLine(p));
    for (const d of back(p, "paragraph")) console.log("   document  " + oneLine(d));
  }
}

console.log("\n=== DEDUP: one node per string, keeping every producer ===");
const hub = "city";
const producers = back(hub, "word");
console.log('   "' + hub + '" is one node, produced by ' + producers.length + " applications");
for (const s of uniq(producers)) console.log("     " + s);
console.log('   "a" appears twice in one sentence, so that sentence is listed twice:');
console.log("     " + back("a", "word").map(oneLine).join("\n     "));

console.log("\n=== THE SINGLE-CHILD CASE ===");
const lone = paragraphs[2].value;
const only = g.node(lone).apply("sentence", "0");
console.log("   paragraph          " + lone);
console.log("   its only sentence  " + only.value);
console.log("   same node?         " + (only === g.node(lone)));
console.log("   so sentence(p,0) points back at its own input — a 2-cycle, visible in the viewer.");

renderData(g);
