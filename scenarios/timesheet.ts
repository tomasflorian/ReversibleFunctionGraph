import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();

const Entry = shapes(g).record("|", ["emp", "date", "proj", "hours", "seq"]);

const log = [
  "bob|2026-08-25|projX|8|1",
  "alice|2026-08-25|projX|5|2",
  "bob|2026-08-26|projX|4|3",
  "bob|2026-08-25|projX|6|4",
];
for (const rec of log) Entry.of(rec);

const field = Entry.read;
const cellKey = (rec: string) => [field(rec, "emp"), field(rec, "date"), field(rec, "proj")].join(" | ");

function allRecords(): string[] {
  return g.node("emp()").to().nodes
    .map(app => app.from().nodes[1]?.value)
    .filter((v): v is string => v !== undefined);
}

console.log("=== the append log (writes, in order) ===");
for (const rec of log) console.log("   " + rec.replace(/\|/g, "  "));

function current(): Map<string, { hours: string; seq: number }> {
  const byCell = new Map<string, { hours: string; seq: number }>();
  for (const rec of allRecords()) {
    const key = cellKey(rec), seq = +field(rec, "seq");
    const cur = byCell.get(key);
    if (!cur || seq > cur.seq) byCell.set(key, { hours: field(rec, "hours"), seq });
  }
  return byCell;
}

console.log("\n=== CURRENT timesheet (latest-wins projection) ===");
for (const [key, v] of current())
  console.log(`   ${key}  ->  ${v.hours}h`);

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
