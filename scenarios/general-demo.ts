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

const bare = `paris,france,europe
tokyo,japan,asia`;

const subGroupedBare = `paris:2.35,48.85
tokyo:139.69,35.68`;


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

for (const r of Rows.of(headered)) Person.of(r.value);

// ---------------------------------------------------------- unheadered CSV
const Lines  = sequence("cutLines",  "line",  c => c.split("\n"));
const Fields = sequence("cutFields", "field", l => l.split(","));

for (const l of Lines.of(bare)) Fields.of(l.value);


// ---------------------------------------------------------- sub grouped bare
const SubGroupedLines  = sequence("cutGroupedLines",  "groupedLine",  c => c.split("\n"));
const SubGroupedFields = sequence("cutGroupedFields", "groupedField", l => l.split(":"));

for (const l of SubGroupedLines.of(subGroupedBare)) SubGroupedFields.of(l.value);


// --------------------------------------------------------------------- JSON
const Items = sequence("cutItems", "item", j => JSON.parse(j).map((o: unknown) => JSON.stringify(o)));

const items = Items.of(json);
const jsonKeys = [...new Set(items.flatMap(i => Object.keys(JSON.parse(i.value))))];

for (const key of jsonKeys)
  g.def(key, s => (JSON.parse(s) as Record<string, string>)[key] ?? null);
for (const item of items) for (const key of jsonKeys) item.apply(key);

// ------------------------------------------------------ custom "key: value"
const Blocks = sequence("cutBlocks", "block", t => t.split("\n\n"));
const Pairs  = sequence("cutPairs",  "pair",  b => b.split("\n"));

const pairs = Blocks.of(config).flatMap(b => Pairs.of(b.value));
const cfgKeys = [...new Set(pairs.map(p => p.value.split(": ")[0]))];

for (const key of cfgKeys) g.def(key, s => s.split(": ")[1] ?? null);
for (const p of pairs) p.apply(p.value.split(": ")[0]);

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
    console.log("   " + rel.padEnd(17) + short(up));
    here = up;
  }
  console.log("");
};
climb("seine",  ["word", "cutWords", "sentence", "cutSentences", "paragraph", "cutParagraphs"]);
climb("france", ["country", "row", "cutRows"]);
climb("europe", ["field", "cutFields", "line", "cutLines"]);
climb("2.35,48.85", ["groupedField", "cutGroupedFields", "groupedLine", "cutGroupedLines"]);
climb("sumida", ["river", "item", "cutItems"]);
climb("japan",  ["nation", "pair", "cutPairs", "block", "cutBlocks"]);

console.log("=== the vocabulary the sources taught the graph ===");
for (const fn of ["city", "country", "place", "river", "name", "nation", "field", "groupedField"])
  console.log("   " + (fn + "()").padEnd(12) + (g.outputsOf(fn).join("  ") || "(nothing)"));
console.log("   country() and nation() mean the same thing and stay apart:");
console.log("     the data named them differently, so nothing fuses them.");
console.log("   field() is anonymous — the unheadered CSV named nothing,");
console.log("     so those parts are reachable by content but not by vocabulary.");

console.log("\n=== the sources share values without sharing shape ===");
console.log('   "paris" was produced by ' + g.node("paris").from().nodes.length + " applications:");
for (const a of g.node("paris").from().nodes) console.log("     " + short(a.value));
