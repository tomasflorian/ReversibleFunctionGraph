// timesheet-cli.ts — an INTERACTIVE console timesheet on the graph.
//   npx tsx ReversibleFunctionGraph2/scenarios/timesheet-cli.ts
//
// Type commands to enter time and view it. Every "add" is an APPEND (a new
// record with the next seq); an edit is just another add for the same cell.
// Views are QUERIES over the graph — "current" is latest-wins per cell, and the
// old values stay as history. Each add also refreshes data.js, so you can keep
// graph.html open and reload to watch the graph grow.
//
//   add <emp> <date> <proj> <hours>   log time (edit = add again for same cell)
//   view                              grid: employee x date, current hours/day
//   list                              every current cell (emp,date,proj -> hours)
//   history <emp> <date> <proj>       all observations for one cell, oldest first
//   log                               the raw append log
//   help / quit

import { Graph, Node, Tree } from "../graph.ts";
import { renderData } from "../viz.ts";
import * as readline from "node:readline";
import { execFile } from "node:child_process";

const DATA = "ReversibleFunctionGraph2/data.js";
const HTML = "ReversibleFunctionGraph2/graph.html";
const g = new Graph();

// A timesheet record is one pipe-joined string:  "emp|date|proj|hours|seq".
// Each function below is taught to the graph under a name, and chops out one
// field. `.apply("emp")` later runs the one named "emp".
g.def("emp",   rec => rec.split("|")[0]);
g.def("date",  rec => rec.split("|")[1]);
g.def("proj",  rec => rec.split("|")[2]);
g.def("hours", rec => rec.split("|")[3]);
g.def("seq",   rec => rec.split("|")[4]);

// A date is itself a record "year-month-day" — so chop it one level deeper.
// Each guards its input: not a date -> null -> NOTHING (silent, leaves no trace),
// so year()/month()/day() only ever hold values chopped from a real date.
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
g.def("year",  d => isDate(d) ? d.split("-")[0] : null);
g.def("month", d => isDate(d) ? d.split("-")[1] : null);
g.def("day",   d => isDate(d) ? d.split("-")[2] : null);

// the field names, in record order — used to chop a whole record at once
const FIELDS = ["emp", "date", "proj", "hours", "seq"];

let seq = 0;
const log: string[] = [];

// pull the Node objects out of a from()/to() Tree
const nodes = (t: Tree): Node[] => t.items.filter(x => x instanceof Node) as Node[];

// run one field-function on a record and hand back its string value (read a field)
const field = (rec: string, f: string) => g.node(rec).apply(f).value;

// the key that identifies one timesheet CELL: which employee, day, project
const cellKey = (rec: string) => `${field(rec, "emp")}|${field(rec, "date")}|${field(rec, "proj")}`;

function addEntry(emp: string, date: string, proj: string, hours: string): void {
  seq++;
  const rec = [emp, date, proj, hours, String(seq)].join("|");
  log.push(rec);                                          // remember the write (append log)
  for (const f of FIELDS) g.node(rec).apply(f);           // chop: store each field in the graph
  const dateNode = g.node(rec).apply("date");             // then chop the date one level deeper
  for (const f of ["year", "month", "day"]) dateNode.apply(f);
  renderData(g, DATA);                                    // keep the viewer in sync
  console.log(`  logged #${seq}: ${emp} ${date} ${proj} ${hours}h`);
}

// current = latest-wins (max seq) observation per (emp,date,proj) cell
function current(): Map<string, { rec: string; hours: string; seq: number }> {
  const byCell = new Map<string, { rec: string; hours: string; seq: number }>();
  for (const rec of log) {
    const key = cellKey(rec), s = +field(rec, "seq");
    const cur = byCell.get(key);
    if (!cur || s > cur.seq) byCell.set(key, { rec, hours: field(rec, "hours"), seq: s });
  }
  return byCell;
}

function view(): void {
  const cur = current();
  const cell = new Map<string, number>(), emps = new Set<string>(), dates = new Set<string>();
  for (const { rec, hours } of cur.values()) {
    const e = field(rec, "emp"), d = field(rec, "date");
    emps.add(e); dates.add(d);
    cell.set(`${e}|${d}`, (cell.get(`${e}|${d}`) ?? 0) + Number(hours));
  }
  const E = [...emps].sort(), D = [...dates].sort();
  if (!E.length) { console.log("  (no entries yet — try: add bob 2026-08-25 projX 8)"); return; }
  const w = Math.max(8, ...E.map(e => e.length));
  const head = "employee".padEnd(w) + " | " + D.join(" | ");
  console.log("  " + head);
  console.log("  " + "-".repeat(head.length));
  for (const e of E) {
    const row = e.padEnd(w) + " | " +
      D.map(d => String(cell.get(`${e}|${d}`) ?? "·").padStart(d.length)).join(" | ");
    console.log("  " + row);
  }
}

function list(): void {
  const cur = current();
  if (!cur.size) { console.log("  (empty)"); return; }
  for (const [key, v] of cur)
    console.log(`  ${key.replace(/\|/g, "  ")}  ->  ${v.hours}h  (seq ${v.seq})`);
}

function history(emp: string, date: string, proj: string): void {
  const key = `${emp}|${date}|${proj}`;
  const versions = log.filter(r => cellKey(r) === key)
    .map(r => ({ seq: +field(r, "seq"), hours: field(r, "hours") }))
    .sort((a, b) => a.seq - b.seq);
  if (!versions.length) { console.log("  (no entries for that cell)"); return; }
  console.log(`  ${key.replace(/\|/g, "  ")} — ${versions.length} observation(s):`);
  for (const v of versions)
    console.log(`     seq ${v.seq}  ->  ${v.hours}h${v.seq === versions[versions.length - 1].seq ? "   <- current" : ""}`);
}

function openBrowser(): void {
  renderData(g, DATA);
  execFile("xdg-open", [HTML], err => {
    if (err) console.log(`  (couldn't auto-open — open ${HTML} in your browser)`);
  });
  console.log(`  opened ${HTML} — reload it after each 'add' to see the graph grow`);
}

const HELP = `commands:
  add <emp> <date> <proj> <hours>   log time (edit = add again for the same cell)
  view                              grid: employee x date, current hours/day
  list                              every current cell (emp date proj -> hours)
  history <emp> <date> <proj>       all observations for one cell (history)
  log                               the raw append log (every write, in order)
  open                              open graph.html to see the graph under the hood
  help                              this
  quit                              exit`;

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

// seed some entries so the first `view` shows something (multiple people,
// dates, and projects — bob works two projects on Monday, so his day sums).
addEntry("bob",   "2026-08-25", "projX", "8");
addEntry("bob",   "2026-08-25", "projY", "12");
addEntry("alice", "2026-11-25", "projX", "11");
addEntry("bob",   "2026-12-26", "projX", "4");
addEntry("carol", "2026-08-26", "projY", "7");
addEntry("alice", "2026-08-26", "projX", "12");
console.log("\ninteractive timesheet — type 'help', 'view', or 'open'. try correcting bob:");
console.log("  add bob 2026-08-25 projX 6\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "timesheet> " });
rl.prompt();
rl.on("line", line => { handle(line.trim()); rl.prompt(); });
rl.on("close", () => { console.log("bye"); process.exit(0); });
