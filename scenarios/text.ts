import { Graph } from "../graph.ts";
import { relate } from "../relate.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { back } = relate(g);
const { sequence } = shapes(g);

const paragraphs = sequence("cutParagraphs", "paragraph", t => t.split("\n\n"));
const sentences  = sequence("cutSentences",  "sentence",  p => p.split("\n"));
const words      = sequence("cutWords",      "word",      s => s.split(" "));

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

console.log("=== TWO RUNGS PER LEVEL: cut, then take ===");
const sent = "the city is old";
console.log("   cutWords(" + sent + ")");
console.log("     -> " + words.list(sent).value);
console.log("   word(" + words.list(sent).value + ", old)");
console.log("     -> " + g.node(words.list(sent).value).apply("word", "old").value);

console.log("\n=== THE DRIVER SPLITS NOTHING ===");
console.log("   for (const p of paragraphs.of(text))");
console.log("     for (const s of sentences.of(p.value))");
console.log("       words.of(s.value);");

console.log("\n=== UP THE LADDER: the names alternate all the way ===");
let here = "old";
console.log("   start         " + JSON.stringify(here));
for (const rel of ["word", "cutWords", "sentence", "cutSentences"]) {
  const up = back(here, rel)[0];
  if (up === undefined) break;
  console.log("   " + rel.padEnd(13) + " " + oneLine(up));
  here = up;
}

console.log("\n=== HUBS: one shared name split into three ===");
for (const fn of ["paragraph", "sentence", "word", "cutParagraphs", "cutSentences", "cutWords"])
  console.log("   " + (fn + "()").padEnd(16) + "degree " + g.node(fn + "()").to().nodes.length);
const worst = g.all()
  .map(n => ({ v: n.value, d: n.from().nodes.length + n.to().nodes.length }))
  .sort((a, b) => b.d - a.d)[0];
console.log("   biggest hub in the graph: " + worst.d + "  " + JSON.stringify(worst.v).slice(0, 40));

console.log("\n=== PER-LEVEL QUERIES, NOW TWO HOPS ===");
const allWords = [...new Set(g.node("word()").to().to().flatten().values)];
console.log("   every word:", allWords.sort().join(" "));
console.log("   every sentence:", g.node("sentence()").to().to().flatten().values.length, "extractions");

console.log("\n=== WHERE THE LEVELS NO LONGER SHARE A FACT ===");
{
  const h = new Graph();
  const sh = shapes(h);
  sh.sequence("cutSentences", "sentence", p => p.split("\n")).of("hello");
  sh.sequence("cutWords", "word", s => s.split(" ")).of("hello");
  console.log("   a one-word sentence, cut both ways:");
  console.log("     " + h.node("hello").to().values.join("   "));
  console.log("   two applications now, not one — the fn name says which cut's list it is.");
}

renderData(g);
