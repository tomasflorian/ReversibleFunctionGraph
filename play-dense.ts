// play-dense.ts — pack the graph as DENSE as possible with representative ops.
//   npx tsx ReversibleFunctionGraph2/play-dense.ts
//
// Density in this model = COLLAPSE + REUSE. Every distinct string is one node, so
// the way to make the graph dense (many edges, few nodes) is to choose inputs and
// functions whose results keep landing on the SAME node. The richest source is an
// ANAGRAM FAMILY — words built from one small letter set — because then:
//   • length()  collapses every word to one int hub          (all len 3 -> "3")
//   • first()/last() collapse to a handful of shared letters  (hubs: a c r t)
//   • sort()    is an anagram signature: cat,act -> "act"; tar,rat,art -> "art"
//   • reverse() sometimes lands on ANOTHER word in the set    (tar <-> rat)
//   • hasLetter(word, "a") makes a huge true/false hub, and reuses the very same
//     letter nodes that first()/last() PRODUCE — so "a" is both an output hub and
//     an input hub at once (the densest thing the model can express).

import { Graph } from "./graph.ts";
import { renderData } from "./viz.ts";

const g = new Graph();
g.def("length", s => String(s.length));
g.def("upper", s => s.toUpperCase());
g.def("reverse", s => s.split("").reverse().join(""));
g.def("first", s => s.charAt(0));
g.def("last", s => s.charAt(s.length - 1));
g.def("sort", s => s.split("").sort().join(""));            // anagram signature
g.def("vowels", s => String((s.match(/[aeiou]/g) ?? []).length));
g.def("hasLetter", (s, c) => String(s.includes(c)));       // multi-arg (UFCS)
g.def("parseRecordType", s=> s.split(":")[0])
g.def("parseRecordValue", s => s.split(":")[1])
g.def("parseIPFromIPWithSubnet", s=> s.split("/")[0]);
g.def("parseSubnetFromIPWithSubnet", s => s.split("/")[1]);
g.def("lastOctetFromIP", s => s.split(".")[3]);

g.node("IP:192.168.1.3/24").apply("parseRecordType");
g.node("IP:192.168.1.3/24").apply("parseRecordValue").apply("parseIPFromIPWithSubnet").apply("lastOctetFromIP");
g.node("IP:192.168.1.3/24").apply("parseRecordValue").apply("parseSubnetFromIPWithSubnet");




// The anagram family — every word is 3 letters from {a,c,r,t}. Maximum overlap.
const words = ["cat", "act", "arc", "car", "tar", "rat", "art"];
const battery = ["length", "upper", "reverse", "first", "last", "sort", "vowels"];

// FAN-IN: every single-arg function over every word. Results collapse onto shared
// hubs (one "3", a few letters, three anagram signatures, some reversed twins).
for (const w of words) {
  for (const fn of battery) g.node(w).apply(fn);
}

// MULTI-ARG FAN-IN: hasLetter(word, letter) over the family's own letters. The
// letter args ("a","c","r","t","z") are shared value nodes — and a,c,r,t are the
// SAME nodes that first()/last() produced above. "z" gives a pure-false hub.
for (const w of words) {
  for (const c of ["a", "c", "r", "t", "z"]) g.node(w).apply("hasLetter", c);
}

// CHAINS that collapse: reverse-then-sort == sort (same signature node), and
// upper-then-length == length (same "3"). The second apply dedups onto an
// existing node instead of adding a new one — depth for free, no new leaf.
for (const w of words) {
  g.node(w).apply("reverse").apply("sort");   // lands on the same signature as sort(w)
  g.node(w).apply("upper").apply("length");   // lands on the same "3"
}

renderData(g);

// ---- HUB REPORT: show the collapses as reverse walks over shared nodes ----

console.log("\n=== biggest hubs (reverse = who produced this) ===");
g.node("3").from().log('length -> "3"     produced by =');    // all 7 words' length calls
g.node("true").from().log('hasLetter true    produced by =').values.length;
g.node("art").from().log('sort -> "art"     produced by =');  // tar, rat, art collapse here

console.log("\n=== the same node is BOTH an output hub and an input hub ===");
g.node("a").from().log('"a" is PRODUCED by (first/last) =');   // first(act), first(arc), first(art)...
g.node("a").to().log('"a" is USED BY (hasLetter args)   =');   // hasLetter(cat,a), hasLetter(act,a)...

console.log("\n=== function addressability: one hop to every call ===");
g.node("sort()").to().log("sort() used in =");                 // every sort(word) application

console.log("\n=== chain collapse: reverse.sort lands where sort already is ===");
const viaSort    = g.node("cat").apply("sort");                // "act"
const viaReverse = g.node("cat").apply("reverse").apply("sort"); // also "act"
console.log("same node?", viaSort === viaReverse, "->", viaSort.value); // true -> act
