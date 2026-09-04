import { Graph, Node, NOTHING } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();

g.def("paragraph", (t, i) => t.split("\n\n")[+i] ?? null);
g.def("sentence",  (p, i) => p.split("\n")[+i]   ?? null);
g.def("word",      (s, i) => s.split(" ")[+i]    ?? null);

const text =
`paris is a city
the city is old

tokyo is a city
the city is new

a city is a place`;

const count = (subject: Node, fn: string): Node[] => {
  const out: Node[] = [];
  for (let i = 0; ; i++) {
    const piece = subject.apply(fn, String(i));
    if (piece.value === NOTHING) break;
    out.push(piece);
  }
  return out;
};

const paragraphs = count(g.node(text), "paragraph");

for (const p of paragraphs)
  for (const s of count(p, "sentence"))
    count(s, "word");

g.node(paragraphs[2].value).apply("sentence", "0");

renderData(g);
