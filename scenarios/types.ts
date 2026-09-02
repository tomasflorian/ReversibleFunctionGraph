// play-types.ts — types are not declared, they are DISCOVERED.
//   npx tsx scenarios/types.ts
//
// A "type" here is just the extension of a predicate: the set of values it
// accepts. Each predicate is identity-on-success (returns the value) and silent
// on failure (returns null — no trace). So when a value passes a predicate, it
// gets marked with that type for free, and a value can carry MANY types at once.
//
// Because the marks are real edges, you can read them BOTH ways:
//   value  → its types    (what produced this value = which predicates passed)
//   type   → its members  (walk the predicate node to everything it accepted)
//
// And a value nobody has tested yet has NO type — not "untyped", just "not asked
// yet". Types appear the moment you ask.

import { Graph, NOTHING } from "../graph.ts";
import { renderData } from "../viz.ts";

const g = new Graph();
const passed = (n: { value: string }) => n.value !== NOTHING;

// ---- a small type lattice (predicates; some built ON others, nested-but-flat) --
g.def("isString", s => s);                                   // top type: always passes
g.def("isNumber", s => /^\d+$/.test(s) ? s : null);
g.def("isPort",   s => passed(g.apply("isNumber", s)) && +s <= 65535 ? s : null); // ⊂ number
g.def("isIP",     s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split(".").every(o => +o <= 255) ? s : null);
g.def("isInternalIP", s => {                                 // ⊂ IP
  if (!passed(g.apply("isIP", s))) return null;              // must be an IP first (nested)
  const [a, b] = s.split(".").map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ? s : null;
});
g.def("isHost", s =>                                         // an IP is a host, or a hostname
  passed(g.apply("isIP", s)) ? s
    : (/^[a-z0-9]+(\.[a-z0-9]+)+$/i.test(s) && /[a-z]/i.test(s) ? s : null));
g.def("isEmail", s => s.includes("@") ? s : null);

const predicates = ["isString", "isNumber", "isPort", "isIP", "isInternalIP", "isHost", "isEmail"];

// ---- ask every predicate of every value (fails are silent, leave no trace) ----
const values = [
  "192.168.1.2",   // many:   string, IP, internalIP, host
  "8.8.8.8",       // several: string, IP, host (public — not internal)
  "db01.internal", // couple:  string, host
  "user@db.local", // couple:  string, email
  "8080",          // several: string, number, port
  "hello world",   // one:     string only
];
for (const v of values) for (const p of predicates) g.node(v).apply(p);

// ---- read it: VALUE → ITS TYPES -------------------------------------------
const nameOf   = (app: string) => app.slice(0, app.indexOf("("));           // "isIP(..)" -> "isIP"
const typesOf  = (v: string) => [...new Set(g.node(v).from().values.map(nameOf))];

console.log("=== VALUE → its types (how many types does this string carry?) ===");
for (const v of values) {
  const t = typesOf(v);
  console.log(`  ${v.padEnd(14)} → ${t.length}: [${t.join(", ")}]`);
}

// ---- read it the other way: TYPE → ITS MEMBERS ----------------------------
// A predicate is identity-on-success, so its result IS the member. Walk the
// predicate node → its applications → their results.  (pure navigation)

console.log("\n=== TYPE → its members (the extension of each predicate) ===");
for (const p of ["isInternalIP", "isIP", "isHost", "isString"]) {
  const m = g.outputsOf(p);
  console.log(`  ${p.padEnd(14)} = {${m.join(", ")}}`);
}
// note the lattice: isInternalIP ⊂ isIP ⊂ isHost ⊂ isString, each a queryable set.

// ---- NO TYPE (yet): a value nobody has asked about ------------------------
console.log("\n=== NO TYPE yet — until you ask ===");
g.node("mystery-blob");                                      // in the graph, never tested
console.log("  mystery-blob →", typesOf("mystery-blob"), "  (nobody asked)");
for (const p of predicates) g.node("mystery-blob").apply(p); // now ask everything
console.log("  mystery-blob →", typesOf("mystery-blob"), "  (after asking: just a string)");

renderData(g);
