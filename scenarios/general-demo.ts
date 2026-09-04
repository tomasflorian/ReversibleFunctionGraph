import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { sequence, record } = shapes(g);

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

g.def("hasFormat", (_raw, name) => name);
const tag = (raw: string, format: string) => g.node(raw).apply("hasFormat", format);

const Paragraphs = sequence("cutParagraphs", "paragraph", t => t.split("\n\n"));
const Sentences  = sequence("cutSentences",  "sentence",  p => p.split("\n"));
const Words      = sequence("cutWords",      "word",      s => s.split(" "));

tag(prose, "prose");
for (const p of Paragraphs.of(prose))
  for (const s of Sentences.of(p.value))
    Words.of(s.value);

const Rows   = sequence("cutRows", "row", c => c.split("\n").slice(1));
const Person = record(",", headered.split("\n")[0].split(","));

tag(headered, "headered-csv");
for (const r of Rows.of(headered)) Person.of(r.value);

const Lines  = sequence("cutLines",  "line",  c => c.split("\n"));
const Fields = sequence("cutFields", "field", l => l.split(","));

tag(bare, "bare-csv");
for (const l of Lines.of(bare)) Fields.of(l.value);

const GroupedLines  = sequence("cutGroupedLines",  "groupedLine",  c => c.split("\n"));
const GroupedFields = sequence("cutGroupedFields", "groupedField", l => l.split(":"));

tag(subGroupedBare, "grouped");
for (const l of GroupedLines.of(subGroupedBare)) GroupedFields.of(l.value);

const Items = sequence("cutItems", "item", j => JSON.parse(j).map((o: unknown) => JSON.stringify(o)));
const items = Items.of(json);
const jsonKeys = [...new Set(items.flatMap(i => Object.keys(JSON.parse(i.value))))];

tag(json, "json");
for (const key of jsonKeys)
  g.def(key, s => (JSON.parse(s) as Record<string, string>)[key] ?? null);
for (const item of items) for (const key of jsonKeys) item.apply(key);

const Blocks = sequence("cutBlocks", "block", t => t.split("\n\n"));
const Pairs  = sequence("cutPairs",  "pair",  b => b.split("\n"));
const pairs  = Blocks.of(config).flatMap(b => Pairs.of(b.value));
const cfgKeys = [...new Set(pairs.map(p => p.value.split(": ")[0]))];

tag(config, "key-value");
for (const key of cfgKeys) g.def(key, s => s.split(": ")[1] ?? null);
for (const p of pairs) p.apply(p.value.split(": ")[0]);

renderData(g);
