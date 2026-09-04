import { Graph } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();
g.def("length", s => String(s.length));
g.def("upper", s => s.toUpperCase());
g.def("reverse", s => s.split("").reverse().join(""));
g.def("first", s => s.charAt(0));
g.def("last", s => s.charAt(s.length - 1));
g.def("sort", s => s.split("").sort().join(""));
g.def("vowels", s => String((s.match(/[aeiou]/g) ?? []).length));
g.def("hasLetter", (s, c) => String(s.includes(c)));
g.def("parseRecordType", s=> s.split(":")[0])
g.def("parseRecordValue", s => s.split(":")[1])
g.def("parseIPFromIPWithSubnet", s=> s.split("/")[0]);
g.def("parseSubnetFromIPWithSubnet", s => s.split("/")[1]);
g.def("lastOctetFromIP", s => s.split(".")[3]);

g.node("IP:192.168.1.3/24").apply("parseRecordType");
g.node("IP:192.168.1.3/24").apply("parseRecordValue").apply("parseIPFromIPWithSubnet").apply("lastOctetFromIP");
g.node("IP:192.168.1.3/24").apply("parseRecordValue").apply("parseSubnetFromIPWithSubnet");

const words = ["cat", "act", "arc", "car", "tar", "rat", "art"];
const battery = ["length", "upper", "reverse", "first", "last", "sort", "vowels"];

for (const w of words) {
  for (const fn of battery) g.node(w).apply(fn);
}

for (const w of words) {
  for (const c of ["a", "c", "r", "t", "z"]) g.node(w).apply("hasLetter", c);
}

for (const w of words) {
  g.node(w).apply("reverse").apply("sort");
  g.node(w).apply("upper").apply("length");
}

g.node("cat").apply("sort");
g.node("cat").apply("reverse").apply("sort");

renderData(g);
