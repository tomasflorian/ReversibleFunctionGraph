import { Graph, NOTHING } from "../graph.ts";
import { renderData } from "../view.ts";

const g = new Graph();

let isValidIPRuns = 0;
let lastOctetRuns = 0;

g.def("isValidIP", s => {
  isValidIPRuns++;
  const ok = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s)
    && s.split(".").every(o => +o <= 255);
  return ok ? s : null;
});

g.def("lastOctet", s => { lastOctetRuns++; return s.split(".")[3]; });

console.log("=== FORWARD: validate then extract, by CHAINING ===");
g.node("192.168.1.3").apply("isValidIP").apply("lastOctet").log("good  =");

console.log("\n=== SKIP: a bad IP short-circuits; lastOctet NEVER runs ===");
const bad = g.node("fifskje").apply("isValidIP").apply("lastOctet");
bad.log("bad   =");
console.log("is NOTHING?", bad.value === NOTHING);

console.log("\n=== SILENT: the failed input left NO trace ===");
g.node("fifskje").to().log("fifskje feeds =");

console.log("\n=== the run counters prove skip + memo ===");
console.log("isValidIP ran:", isValidIPRuns, "time(s)");
console.log("lastOctet ran:", lastOctetRuns, "time(s)");

g.node("192.168.1.3").apply("isValidIP").apply("lastOctet");
console.log("after re-running the GOOD chain (memoized, no impl fires):");
console.log("  isValidIP ran:", isValidIPRuns, "time(s)");
console.log("  lastOctet ran:", lastOctetRuns, "time(s)");

g.node("fifskje").apply("isValidIP");
console.log("after re-running the BAD input (not memoized, guard re-fires):");
console.log("  isValidIP ran:", isValidIPRuns, "time(s)");

console.log("\n=== FLAT still holds: an inner call is a sibling, not a child ===");

g.def("octetSum", s => {
  const ok = g.apply("isValidIP", s);
  if (ok.value === NOTHING) return null;
  return String(s.split(".").reduce((a, o) => a + +o, 0));
});
g.node("10.0.0.5").apply("octetSum").log("octetSum =");

g.node("octetSum(10.0.0.5)").from().log("octetSum inputs =");

renderData(g);
