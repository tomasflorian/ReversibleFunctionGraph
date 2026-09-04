import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();
const { record } = shapes(g);

g.def("length",  s => String(s.length));
g.def("upper",   s => s.toUpperCase());
g.def("reverse", s => s.split("").reverse().join(""));
g.def("first",   s => s.charAt(0));
g.def("last",    s => s.charAt(s.length - 1));
g.def("sort",    s => s.split("").sort().join(""));
g.def("vowels",  s => String((s.match(/[aeiou]/g) ?? []).length));
g.def("hasLetter", (s, c) => String(s.includes(c)));

const words   = ["cat", "act", "arc", "car", "tar", "rat", "art"];
const battery = ["length", "upper", "reverse", "first", "last", "sort", "vowels"];

for (const w of words) {
  for (const fn of battery) g.node(w).apply(fn);
  for (const c of ["a", "c", "r", "t", "z"]) g.node(w).apply("hasLetter", c);
  g.node(w).apply("reverse").apply("sort");
  g.node(w).apply("upper").apply("length");
}

record(":", ["recordType", "recordValue"]);
record("/", ["ip", "subnet"]);
record(".", ["octet1", "octet2", "octet3", "octet4"]);

const raw = "IP:192.168.1.3/24";
g.node(raw).apply("recordType");
g.node(raw).apply("recordValue").apply("ip").apply("octet4");
g.node(raw).apply("recordValue").apply("subnet");

g.node("cat").apply("sort");
g.node("cat").apply("reverse").apply("sort");

renderData(g);
