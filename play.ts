// play.ts — a tiny demo of RFG2. Run it:
//   npx tsx ReversibleFunctionGraph2/play.ts

import { Graph } from "./graph.ts";
import { renderData } from "./viz.ts";

const g = new Graph();
g.def("upper", s => s.toUpperCase());
g.def("length", s => String(s.length));
g.def("strContains", (h, n) => String(h.includes(n)));

// FORWARD — apply returns the result value; the Application node is built behind it
g.node("paris").apply("upper").log("upper =");                  // upper = PARIS
g.node("paris").apply("length").log("length =");                // length = 5

// MULTI-ARG — UFCS: the subject is arg 0
g.node("paris france").apply("strContains", "france").log("has =");  // has = true

// CHAINING — the result flows into the next call
g.node("paris").apply("upper").apply("length").log("upper.len ="); // upper.len = 5  (length of PARIS)

// REVERSE — unlabeled; the Application node sits in the path (two hops).
// Navigation preserves structure: each hop nests one level deeper.
g.node("5").from().log("produced 5 =");            // [length(paris), length(PARIS)]
g.node("5").from().from().log("their inputs =");   // [[length(), paris], [length(), PARIS]]  ← the tree
g.node("5").from().from().flatten().log("flat ="); // [length(), paris, length(), PARIS]        ← opt-in bag

// FUNCTION ADDRESSABILITY — a function is a node; walk to every call that used it
g.node("upper()").to().log("upper used in =");     // [upper(paris)]

// write the graph data (open ReversibleFunctionGraph2/graph.html, reload after runs)
renderData(g);
