// timesheet.ts — a real app on the graph: enter entries, "edit" by APPENDING,
// and read the current view as a LATEST-WINS query.
//   ./show.sh timesheet
//
// The point: there is no mutable cell. An entry is a record; an EDIT is a new
// record with a later seq; the "current" value is a QUERY (max seq per cell).
// Nothing is overwritten — the old value is still in the graph, walkable as
// history. "Latest wins" is NOT an engine feature: seq lives in the DATA, and
// the projection picks the max. The reader chooses the rule.

import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();

// each entry is one raw record: "emp|date|project|hours|seq". record() declares
// that shape — it defs one field-function per field, and hands back chop/read.
// (seq is just data — the ordering. The engine knows nothing about time.)
const Entry = shapes(g).record("|", ["emp", "date", "proj", "hours", "seq"]);

// ---- THE APPEND LOG (every write, in order) --------------------------------
const log = [
  "bob|2026-08-25|projX|8|1",     // #1 bob logs 8h Monday
  "alice|2026-08-25|projX|5|2",   // #2 alice logs 5h
  "bob|2026-08-26|projX|4|3",     // #3 bob logs 4h Tuesday
  "bob|2026-08-25|projX|6|4",     // #4 CORRECTION: bob's Monday was really 6h
];
for (const rec of log) Entry.chop(rec);

// ---- read helpers (everything is a query over the graph) -------------------
const field = Entry.read;
const cellKey = (rec: string) => [field(rec, "emp"), field(rec, "date"), field(rec, "proj")].join(" | ");

// discover ALL entries FROM THE GRAPH (not from `log`): emp() -> apps -> records.
// An application's inputs are [emp(), subject] IN THAT ORDER — that is how apply
// builds them — so the record is index 1. Read from structure, never by testing
// what a name looks like.
function allRecords(): string[] {
  return g.node("emp()").to().nodes
    .map(app => app.from().nodes[1]?.value)
    .filter((v): v is string => v !== undefined);
}

console.log("=== the append log (writes, in order) ===");
for (const rec of log) console.log("   " + rec.replace(/\|/g, "  "));

// ---- PROJECTION: current timesheet = max-seq observation per cell -----------
function current(): Map<string, { hours: string; seq: number }> {
  const byCell = new Map<string, { hours: string; seq: number }>();
  for (const rec of allRecords()) {            // query the graph for every entry
    const key = cellKey(rec), seq = +field(rec, "seq");
    const cur = byCell.get(key);
    if (!cur || seq > cur.seq) byCell.set(key, { hours: field(rec, "hours"), seq }); // latest wins
  }
  return byCell;
}

console.log("\n=== CURRENT timesheet (latest-wins projection) ===");
for (const [key, v] of current())
  console.log(`   ${key}  ->  ${v.hours}h`);

// ---- the edit did NOT overwrite — history is still here ---------------------
console.log("\n=== history: nothing was erased ===");
const target = "bob | 2026-08-25 | projX";
const versions = allRecords()
  .filter(r => cellKey(r) === target)
  .map(r => ({ seq: +field(r, "seq"), hours: field(r, "hours") }))
  .sort((a, b) => a.seq - b.seq);
console.log(`   cell "${target}" has ${versions.length} observations:`);
for (const v of versions) console.log(`      seq ${v.seq}  ->  ${v.hours}h`);
console.log('   the old "8" node still exists, produced by:');
for (const app of g.node("8").from().nodes) console.log("      " + app.value);

renderData(g);
