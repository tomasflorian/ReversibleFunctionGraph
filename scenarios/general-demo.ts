import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { relate } from "../relate.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { sequence, record } = shapes(g);
const { back } = relate(g);

const prose = `paris sits on the seine
tokyo sits on the sumida

a city is a place`;

const headered = `city,country
paris,france
tokyo,japan`;

const bare = `paris,2.35,48.85
tokyo,139.69,35.68`;

const json = `[{"place":"paris","river":"seine"},{"place":"tokyo","river":"sumida"}]`;

const config = `name: paris
nation: france

name: tokyo
nation: japan`;

// ---------------------------------------------------------------- raw text
const Paragraphs = sequence("cutParagraphs", "paragraph", t => t.split("\n\n"));
const Sentences  = sequence("cutSentences",  "sentence",  p => p.split("\n"));
const Words      = sequence("cutWords",      "word",      s => s.split(" "));

for (const p of Paragraphs.of(prose))
  for (const s of Sentences.of(p.value))
    Words.of(s.value);

// ------------------------------------------------------------ headered CSV
const Rows = sequence("cutRows", "row", c => c.split("\n").slice(1));
const Person = record(",", headered.split("\n")[0].split(","));

for (const r of Rows.of(headered)) Person.chop(r.value);

// ---------------------------------------------------------- unheadered CSV
const Lines  = sequence("cutLines",  "line",  c => c.split("\n"));
const Fields = sequence("cutFields", "field", l => l.split(","));

for (const l of Lines.of(bare)) Fields.of(l.value);

// --------------------------------------------------------------------- JSON
const Items = sequence("cutItems", "item", j => JSON.parse(j).map((o: unknown) => JSON.stringify(o)));

for (const item of Items.of(json)) {
  const obj = JSON.parse(item.value) as Record<string, string>;
  for (const key of Object.keys(obj)) {
    g.def(key, s => (JSON.parse(s) as Record<string, string>)[key] ?? null);
    item.apply(key);
  }
}

// ------------------------------------------------------ custom "key: value"
const Blocks = sequence("cutBlocks", "block", t => t.split("\n\n"));
const Pairs  = sequence("cutPairs",  "pair",  b => b.split("\n"));

for (const b of Blocks.of(config))
  for (const p of Pairs.of(b.value)) {
    const key = p.value.split(": ")[0];
    g.def(key, s => s.split(": ")[1] ?? null);
    p.apply(key);
  }

renderData(g);

// ============================================================ what came out
const short = (s: string) => {
  const flat = s.replace(/\n/g, " / ");
  return flat.length > 40 ? flat.slice(0, 37) + "..." : flat;
};

console.log("=== five sources, one technique ===");
const sources: [string, string, string][] = [
  ["raw text",       prose,    "cutParagraphs"],
  ["headered CSV",   headered, "cutRows"],
  ["unheadered CSV", bare,     "cutLines"],
  ["JSON",           json,     "cutItems"],
  ["key: value",     config,   "cutBlocks"],
];
for (const [name, raw, cut] of sources) {
  const list = g.node(raw).apply(cut).value;
  console.log("   " + name.padEnd(16) + cut.padEnd(15) + list.split("|").length + " members");
}

console.log("\n=== every leaf climbs back to its own source ===");
const climb = (leaf: string, rels: string[]) => {
  console.log("   leaf            " + leaf);
  let here = leaf;
  for (const rel of rels) {
    const up = back(here, rel)[0];
    if (up === undefined) break;
    console.log("   " + rel.padEnd(15) + short(up));
    here = up;
  }
  console.log("");
};
climb("seine",  ["word", "cutWords", "sentence", "cutSentences", "paragraph", "cutParagraphs"]);
climb("france", ["country", "row", "cutRows"]);
climb("48.85",  ["field", "cutFields", "line", "cutLines"]);
climb("sumida", ["river", "item", "cutItems"]);

console.log("=== the sources share values without sharing shape ===");
console.log('   "paris" was produced by ' + g.node("paris").from().nodes.length + " applications:");
for (const a of g.node("paris").from().nodes) console.log("     " + short(a.value));
