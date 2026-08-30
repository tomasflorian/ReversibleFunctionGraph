// timesheet-cli.ts — an INTERACTIVE console timesheet on the graph.
//   npx tsx ReversibleFunctionGraph2/scenarios/timesheet-cli.ts
//
// Ordering is IN THE GRAPH, not in a counter. A record is "emp|date|proj|hours"
// (no seq!). Correcting a cell appends a new record AND draws a `supersedes`
// edge from the old observation to the new one. "Current" is the tip of that
// chain — the observation nothing supersedes — found by walking edges. There is
// no out-of-band counter or clock anywhere; the order is the structure.
//
//   add <emp> <date> <proj> <hours>   log time (edit = add again for same cell)
//   view                              grid: employee x date, current hours/day
//   list                              every current cell (emp,date,proj -> hours)
//   history <emp> <date> <proj>       the supersedes chain, oldest -> current
//   log                               the raw append log (unordered; order is edges)
//   open / help / quit

import { Graph, Node, Tree } from "../graph.ts";
import { renderData } from "../viz.ts";
import * as readline from "node:readline";
import { execFile } from "node:child_process";

const DATA = "ReversibleFunctionGraph2/data.js";
const HTML = "ReversibleFunctionGraph2/graph.html";
const g = new Graph();

// A record is "emp|date|proj|hours" — each function chops out one field.
g.def("emp",   rec => rec.split("|")[0]);
g.def("date",  rec => rec.split("|")[1]);
g.def("proj",  rec => rec.split("|")[2]);
g.def("hours", rec => rec.split("|")[3]);

// A date is itself "year-month-day" — chop one level deeper, guarded.
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
g.def("year",  d => isDate(d) ? d.split("-")[0] : null);
g.def("month", d => isDate(d) ? d.split("-")[1] : null);
g.def("day",   d => isDate(d) ? d.split("-")[2] : null);

// supersedes(old, new) asserts "new replaces old". It just returns `new` (the
// winner), so the edge runs  old -> supersedes(old,new) -> new.  Ordering = this.
g.def("supersedes", (_old, neu) => neu);

const FIELDS = ["emp", "date", "proj", "hours"];
const log: string[] = []; // every appended record (UNORDERED — order lives in edges)

const nodes = (t: Tree): Node[] => t.items.filter(x => x instanceof Node) as Node[];
const field = (rec: string, f: string) => g.node(rec).apply(f).value;
const cellKey = (rec: string) => `${field(rec, "emp")}|${field(rec, "date")}|${field(rec, "proj")}`;

// walk one step forward: the record that supersedes `rec`, or null if it's the tip
function nextOf(rec: string): string | null {
  for (const app of nodes(g.node(rec).to()))
    if (app.value.startsWith(`supersedes(${rec},`)) return nodes(app.to())[0].value;
  return null;
}
// the current observation of a cell = the one nothing supersedes (chain tip)
const tipOf = (recs: string[]) => recs.find(r => nextOf(r) === null);
// the whole chain of a cell, oldest -> tip (root = the record that is nobody's `next`)
function chainOf(recs: string[]): string[] {
  const nexts = new Set(recs.map(nextOf));
  let cur = recs.find(r => !nexts.has(r));
  const out: string[] = [];
  while (cur) { out.push(cur); cur = nextOf(cur) ?? undefined; }
  return out;
}

function recsByCell(): Map<string, string[]> {
  const cells = new Map<string, string[]>();
  for (const rec of log) (cells.get(cellKey(rec)) ?? cells.set(cellKey(rec), []).get(cellKey(rec))!).push(rec);
  return cells;
}
// cellKey -> current record (the tip)
function current(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, recs] of recsByCell()) { const t = tipOf(recs); if (t) out.set(key, t); }
  return out;
}

function addEntry(emp: string, date: string, proj: string, hours: string): void {
  const rec = [emp, date, proj, hours].join("|");
  for (const f of FIELDS) g.node(rec).apply(f);               // chop the record's fields
  const dateNode = g.node(rec).apply("date");                 // chop the date deeper
  for (const f of ["year", "month", "day"]) dateNode.apply(f);

  // if the cell already has a current observation, the new one supersedes it
  const existing = log.filter(r => cellKey(r) === cellKey(rec));
  const oldTip = tipOf(existing);
  if (oldTip && oldTip !== rec) g.node(oldTip).apply("supersedes", rec); // <- order as an edge

  log.push(rec);
  renderData(g, DATA);
  console.log(`  logged: ${emp} ${date} ${proj} ${hours}h${oldTip ? "   (supersedes " + field(oldTip, "hours") + "h)" : ""}`);
}

function view(): void {
  const cell = new Map<string, number>(), emps = new Set<string>(), dates = new Set<string>();
  for (const rec of current().values()) {
    const e = field(rec, "emp"), d = field(rec, "date");
    emps.add(e); dates.add(d);
    cell.set(`${e}|${d}`, (cell.get(`${e}|${d}`) ?? 0) + Number(field(rec, "hours")));
  }
  const E = [...emps].sort(), D = [...dates].sort();
  if (!E.length) { console.log("  (no entries yet — try: add bob 2026-08-25 projX 8)"); return; }
  const w = Math.max(8, ...E.map(e => e.length));
  const head = "employee".padEnd(w) + " | " + D.join(" | ");
  console.log("  " + head);
  console.log("  " + "-".repeat(head.length));
  for (const e of E)
    console.log("  " + e.padEnd(w) + " | " +
      D.map(d => String(cell.get(`${e}|${d}`) ?? "·").padStart(d.length)).join(" | "));
}

function list(): void {
  const cur = current();
  if (!cur.size) { console.log("  (empty)"); return; }
  for (const [key, rec] of cur) console.log(`  ${key.replace(/\|/g, "  ")}  ->  ${field(rec, "hours")}h`);
}

function history(emp: string, date: string, proj: string): void {
  const key = `${emp}|${date}|${proj}`;
  const recs = log.filter(r => cellKey(r) === key);
  if (!recs.length) { console.log("  (no entries for that cell)"); return; }
  const chain = chainOf(recs);
  console.log(`  ${key.replace(/\|/g, "  ")} — ${chain.length} observation(s), oldest first:`);
  console.log("     " + chain.map((r, i) =>
    `${field(r, "hours")}h${i === chain.length - 1 ? " (current)" : ""}`).join("  ->  "));
}

function openBrowser(): void {
  renderData(g, DATA);
  execFile("xdg-open", [HTML], err => { if (err) console.log(`  (open ${HTML} yourself)`); });
  console.log(`  opened ${HTML} — reload after each 'add'`);
}

const HELP = `commands:
  add <emp> <date> <proj> <hours>   log time (edit = add again for the same cell)
  view                              grid: employee x date, current hours/day
  list                              every current cell (emp date proj -> hours)
  history <emp> <date> <proj>       the supersedes chain, oldest -> current
  log                               the raw append log (order is in edges, not here)
  open                              open graph.html
  help / quit`;

function handle(line: string): void {
  const [cmd, ...args] = line.split(/\s+/).filter(Boolean);
  switch (cmd) {
    case undefined: return;
    case "add":
      if (args.length !== 4) { console.log("  usage: add <emp> <date> <proj> <hours>"); return; }
      addEntry(args[0], args[1], args[2], args[3]); return;
    case "view": view(); return;
    case "list": list(); return;
    case "history":
      if (args.length !== 3) { console.log("  usage: history <emp> <date> <proj>"); return; }
      history(args[0], args[1], args[2]); return;
    case "log":
      if (!log.length) { console.log("  (empty)"); return; }
      log.forEach((r, i) => console.log(`  #${i + 1}  ${r.replace(/\|/g, "  ")}`)); return;
    case "open": case "graph": openBrowser(); return;
    case "help": console.log(HELP); return;
    case "quit": case "exit": rl.close(); return;
    default: console.log(`  unknown: "${cmd}".  type "help".`);
  }
}

// seed some entries (your values — note the 11/12 hours that collide with months)
addEntry("bob",   "2026-08-25", "projX", "8");
addEntry("bob",   "2026-08-25", "projY", "12");
addEntry("alice", "2026-11-25", "projX", "11");
addEntry("bob",   "2026-12-26", "projX", "4");
addEntry("carol", "2026-08-26", "projY", "7");
addEntry("alice", "2026-08-26", "projX", "12");
console.log("\ninteractive timesheet — 'help', 'view', 'open'. correct bob and watch:");
console.log("  add bob 2026-08-25 projX 6   then   history bob 2026-08-25 projX\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "timesheet> " });
rl.prompt();
rl.on("line", line => { handle(line.trim()); rl.prompt(); });
rl.on("close", () => { console.log("bye"); process.exit(0); });
