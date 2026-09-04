import { Graph, NOTHING } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const passed = (n: { value: string }) => n.value !== NOTHING;

g.def("isString", s => s);
g.def("isNumber", s => /^\d+$/.test(s) ? s : null);
g.def("isPort",   s => passed(g.apply("isNumber", s)) && +s <= 65535 ? s : null);
g.def("isIP",     s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split(".").every(o => +o <= 255) ? s : null);
g.def("isInternalIP", s => {
  if (!passed(g.apply("isIP", s))) return null;
  const [a, b] = s.split(".").map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ? s : null;
});
g.def("isHost", s =>
  passed(g.apply("isIP", s)) ? s
    : (/^[a-z0-9]+(\.[a-z0-9]+)+$/i.test(s) && /[a-z]/i.test(s) ? s : null));
g.def("isEmail", s => s.includes("@") ? s : null);

const predicates = ["isString", "isNumber", "isPort", "isIP", "isInternalIP", "isHost", "isEmail"];

const values = [
  "192.168.1.2",
  "8.8.8.8",
  "db01.internal",
  "user@db.local",
  "8080",
  "hello world",
];
for (const v of values) for (const p of predicates) g.node(v).apply(p);

g.node("mystery-blob");
for (const p of predicates) g.node("mystery-blob").apply(p);

renderData(g);
