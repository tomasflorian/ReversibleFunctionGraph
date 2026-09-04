import { Graph, NOTHING } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();

g.def("isValidIP", s => {
  const ok = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s)
    && s.split(".").every(o => +o <= 255);
  return ok ? s : null;
});

g.def("lastOctet", s => s.split(".")[3]);

g.node("192.168.1.3").apply("isValidIP").apply("lastOctet");

g.node("fifskje").apply("isValidIP").apply("lastOctet");

g.def("octetSum", s => {
  const ok = g.apply("isValidIP", s);
  if (ok.value === NOTHING) return null;
  return String(s.split(".").reduce((a, o) => a + +o, 0));
});
g.node("10.0.0.5").apply("octetSum");

renderData(g);
