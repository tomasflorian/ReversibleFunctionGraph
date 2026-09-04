import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();
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

renderData(g);
