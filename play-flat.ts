// play-flat.ts — functions calling functions, NESTED but FLAT.
//   npx tsx ReversibleFunctionGraph2/play-flat.ts
//
// A function body uses another function by calling g.apply(...). The inner call
// traces and memoizes like any top-level call — but it stays FLAT: it hangs off
// its OWN inputs as a sibling of the outer call. There is never an arrow from
// one application to another, so an arrow keeps its single meaning (dataflow).
//
// The rule we're honoring: NEVER draw application → application. Inner calls are
// siblings, not children. You can see two calls happened on the same value; you
// can't (and don't) encode "this call invoked that call" as an edge.

import { Graph } from "./graph.ts";
import { renderData } from "./viz.ts";

const g = new Graph();

// a run-counter, so we can PROVE the inner call memoizes across nesting:
// the impl body only runs on a genuine cache miss.
let isValidIPRuns = 0;

// PRIMITIVE (plain JS) — a filter/guard: identity on success, "null" on failure.
// (record-mode here, so the guard leaves a trace we can look at; a big-document
//  filter would run silent — that's the dial, not built in this demo.)
g.def("isValidIP", s => {
  isValidIPRuns++;
  const ok = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s)
    && s.split(".").every(o => +o <= 255);
  return ok ? s : "null";
});

// COMPOSITE — uses isValidIP THROUGH the graph, then does plain-JS guts.
// g.apply("isValidIP", s) is the nested call: it traces + memoizes on its own.
// The split(".") is mechanical guts — not worth a node, stays plain JS.
g.def("lastOctet", s => {
  const checked = g.apply("isValidIP", s);        // ← nested, traced, flat
  if (checked.value === "null") return "null";    // short-circuit on failure
  return checked.value.split(".")[3];
});

// ANOTHER COMPOSITE that ALSO validates — to show the inner call is SHARED.
g.def("firstOctet", s => {
  const checked = g.apply("isValidIP", s);        // same inner call as above
  if (checked.value === "null") return "null";
  return checked.value.split(".")[0];
});

const ip = "192.168.1.3";

// --- run two composites on the same IP -------------------------------------
g.node(ip).apply("lastOctet").log("lastOctet  =");   // 3
g.node(ip).apply("firstOctet").log("firstOctet =");  // 192

console.log("\n=== FLAT: the inner call is a SIBLING, not a child ===");
// The value has THREE applications hanging off it — the two composites AND the
// validation they each triggered. All siblings, all off `ip`.
g.node(ip).to().log(`${ip} feeds =`);
//  -> [lastOctet(192.168.1.3), isValidIP(192.168.1.3), firstOctet(192.168.1.3)]

// Proof of flatness: lastOctet's OWN inputs are just its function + arg.
// isValidIP is NOT among them — there is no application → application edge.
g.node(`lastOctet(${ip})`).from().log("lastOctet's inputs =");
//  -> [lastOctet(), 192.168.1.3]   (NOT isValidIP — that's the whole point)

console.log("\n=== MEMOIZED: the shared inner call ran ONCE ===");
// Both composites (and a direct call) route to the SAME isValidIP application.
g.node(ip).apply("isValidIP");                       // a third route to it
g.node("isValidIP()").to().log("isValidIP used in ="); // one application, shared
//  -> [isValidIP(192.168.1.3)]
console.log("isValidIP impl actually ran:", isValidIPRuns, "time(s)"); // 1

console.log("\n=== IDENTITY-ON-SUCCESS: a passed value marks itself ===");
// isValidIP(ip) -> ip, so the validation points BACK at its own input.
// The value is both produced-by and used-by its validation (self-mark).
g.node(ip).from().log(`${ip} produced by =`);        // [isValidIP(192.168.1.3)]

console.log("\n=== FAILURE path (record-mode) leaves its own flat trace ===");
g.node("192.168.1").apply("lastOctet").log("lastOctet(bad) =");   // null
g.node("null").from().log('"null" produced by =');
//  -> [isValidIP(192.168.1), lastOctet(192.168.1)]  (both siblings off the bad input)

renderData(g);
