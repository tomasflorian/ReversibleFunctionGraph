// flat.ts — functions calling functions (NESTED but FLAT), plus the NOTHING /
// skip mechanic.
//
// SPEAKS: graph.ts — model level on purpose. NOTHING, memoization and the
// no-application-points-at-an-application rule are kernel mechanics; no
// vocabulary above has anything to say about them.
//   npx tsx scenarios/flat.ts
//
// Two things shown together:
//  1) FLAT: a function body uses another via g.apply(...). The inner call traces
//     and memoizes, but hangs off its OWN inputs as a sibling. Never an arrow
//     from one application to another — an arrow keeps its one meaning.
//  2) NOTHING: an impl returns a string to RECORD, or JS null to skip silently.
//     apply short-circuits on NOTHING, so a failed step carries through a chain
//     and downstream functions NEVER run on it. The skip lives in apply.

import { Graph, NOTHING } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();

// counters, to PROVE (a) memoization and (b) that downstream never runs on NOTHING
let isValidIPRuns = 0;
let lastOctetRuns = 0;

// FILTER/GUARD — identity on success, JS null on failure (silent: no trace).
g.def("isValidIP", s => {
  isValidIPRuns++;
  const ok = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s)
    && s.split(".").every(o => +o <= 255);
  return ok ? s : null;                 // <-- null = "don't record", yield NOTHING
});

// PURE extractor — assumes a valid IP. No guard inside: chaining guards it,
// and apply guarantees this never runs on a failed value.
g.def("lastOctet", s => { lastOctetRuns++; return s.split(".")[3]; });

console.log("=== FORWARD: validate then extract, by CHAINING ===");
g.node("192.168.1.3").apply("isValidIP").apply("lastOctet").log("good  =");  // 3
// isValidIP("192.168.1.3") -> "192.168.1.3" (identity), then lastOctet -> "3"

console.log("\n=== SKIP: a bad IP short-circuits; lastOctet NEVER runs ===");
const bad = g.node("fifskje").apply("isValidIP").apply("lastOctet");
bad.log("bad   =");                                       // ∅  (NOTHING)
console.log("is NOTHING?", bad.value === NOTHING);        // true
//  isValidIP("fifskje") -> null -> NOTHING (unrecorded)
//  .apply("lastOctet") on NOTHING -> short-circuits -> NOTHING, impl skipped

console.log("\n=== SILENT: the failed input left NO trace ===");
g.node("fifskje").to().log("fifskje feeds =");            // []  (nothing recorded)

console.log("\n=== the run counters prove skip + memo ===");
console.log("isValidIP ran:", isValidIPRuns, "time(s)");  // 2 — good IP + bad IP
console.log("lastOctet ran:", lastOctetRuns, "time(s)");  // 1 — good only (skipped on bad)

// re-run the GOOD chain: fully recorded last time, so fully MEMOIZED now.
g.node("192.168.1.3").apply("isValidIP").apply("lastOctet");
console.log("after re-running the GOOD chain (memoized, no impl fires):");
console.log("  isValidIP ran:", isValidIPRuns, "time(s)");  // still 2
console.log("  lastOctet ran:", lastOctetRuns, "time(s)");  // still 1

// re-run the BAD input: failures aren't recorded, so they can't be memoized —
// the guard re-runs every time. An honest cost of "don't record failures".
g.node("fifskje").apply("isValidIP");
console.log("after re-running the BAD input (not memoized, guard re-fires):");
console.log("  isValidIP ran:", isValidIPRuns, "time(s)");  // 3 — re-ran

console.log("\n=== FLAT still holds: an inner call is a sibling, not a child ===");
// a composite that validates INSIDE its body via g.apply — inner call is flat.
g.def("octetSum", s => {
  const ok = g.apply("isValidIP", s);                     // nested, traced, flat
  if (ok.value === NOTHING) return null;                  // propagate the skip
  return String(s.split(".").reduce((a, o) => a + +o, 0));
});
g.node("10.0.0.5").apply("octetSum").log("octetSum =");   // 15
// octetSum's OWN inputs are just its function + arg — isValidIP is NOT among them
g.node("octetSum(10.0.0.5)").from().log("octetSum inputs =");  // [octetSum(), 10.0.0.5]

renderData(g);
