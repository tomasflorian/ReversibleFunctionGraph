// play.ts — a tiny demo of RFG2. Run it, edit it, watch it re-run:
//   npx tsx scenarios/basic.ts
//   npx tsx watch scenarios/basic.ts
//
// This is v1's play.ts translated into v2's model. FORWARD apply is identical.
// Two honest differences, flagged inline where they bite:
//   • Reverse is UNLABELED and TWO HOPS — value → Application → inputs — because
//     the Application is now a node you land on (that IS the win). v1's labeled
//     one-hop `from("length")` becomes `from()` (the calls) then `from()` again.
//   • The two-hop inputs INCLUDE the function node (length()) — a trade of the
//     unlabeled model. Function addressability is v2's clean answer instead.
//   • digest() is deferred in v2, so CUT stops at the |-list.

import { Graph } from "../graph.ts";
import { renderData } from "../viz.ts";

const g = new Graph();
g.def("length", s => String(s.length));
g.def("upper", s => s.toUpperCase());
g.def("firstLetter", s => s.charAt(0));
g.def("cut", s => s.split("").join("|"));      // "lima" -> "l|i|m|a"
g.def("cutWords", s => s.split(" ").join("|")); // "paris france" -> "paris|france"

// build some edges
for (const city of ["paris", "tokyo"]) {
  g.node(city).apply("length");
  g.node(city).apply("firstLetter");
  g.node(city).apply("upper");
}

g.node("paris france").apply("cutWords").log("cutWords =");   // paris|france
g.node("paris").apply("cut");

// FORWARD (identical to v1) — apply returns one Node; .log() chains
g.node("paris").apply("length").log("paris.length =");    // 5
g.node("paris").apply("upper").log("paris.upper  =");     // PARIS

// REVERSE — v1 did this in ONE labeled hop: 5.from("length") = [paris, tokyo].
// v2 has no labels: 5.from() lands on the APPLICATIONS that produced 5 (their
// call strings still say "length"); one MORE hop reaches the inputs.
g.node("5").from().log("produced 5 =");           // [length(paris), length(tokyo)]
g.node("5").from().from().log("their inputs =");  // [[length(), paris], [length(), tokyo]]

// raw strings — now the Application strings (v1's .values gave the words directly)
console.log("as strings:", g.node("5").from().values); // [ 'length(paris)', 'length(tokyo)' ]

// words starting with p — v1: from("firstLetter") = [paris]. v2: the Application.
g.node("p").from().log("starts with p =");        // [firstLetter(paris)]

// v1 then MARCHED forward: from("firstLetter").apply("upper") = [PARIS]. That
// doesn't carry over cleanly — reverse lands on firstLetter(paris), not "paris",
// so apply("upper") would uppercase the call string. v2's forward-from-a-function
// is the clean move instead:

// FUNCTION ADDRESSABILITY (new in v2) — a function is a node; one forward hop
// gives every call that used it. This is v2's answer to "where was length used?"
g.node("length()").to().log("length used in =");  // [length(paris), length(tokyo)]

// CUT — v1 followed with g.digest() to break the |-list into shared letter nodes.
// digest is DEFERRED in v2 (see spec), so we stop at the |-list value.
for (const w of ["lima", "bat", "cat", "arc"]) g.node(w).apply("cut").log("cut =");
// g.digest();  // <- not yet in v2

// write the graph data (open graph.html, reload after runs)
renderData(g);
