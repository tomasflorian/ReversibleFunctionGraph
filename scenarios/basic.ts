import { Graph } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();
g.def("length", s => String(s.length));
g.def("upper", s => s.toUpperCase());
g.def("firstLetter", s => s.charAt(0));
g.def("cut", s => s.split("").join("|"));
g.def("cutWords", s => s.split(" ").join("|"));

for (const city of ["paris", "tokyo"]) {
  g.node(city).apply("length");
  g.node(city).apply("firstLetter");
  g.node(city).apply("upper");
}

g.node("paris france").apply("cutWords");
g.node("paris").apply("cut");

g.node("paris").apply("length");
g.node("paris").apply("upper");

for (const w of ["lima", "bat", "cat", "arc"]) g.node(w).apply("cut");

renderData(g);
