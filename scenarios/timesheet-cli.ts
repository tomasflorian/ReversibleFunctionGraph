// timesheet-cli.ts — an INTERACTIVE console timesheet on the graph.
//   npx tsx ReversibleFunctionGraph2/scenarios/timesheet-cli.ts
//
// An entry is a whole record "emp|date|proj|hours". Its IDENTITY is a CHAIN of
// edits, not its field values — so you can edit ANY field (even the project) and
// it's still the same entry. `edit(old, new) -> new` links a correction:
//     old -> edit(old,new) -> new
// "Current" is the tip of the chain (nothing edits it). Views auto-resolve to
// the tip; the old versions stay in the graph as history. No counter, no clock —
// ordering is the edit edges. Nothing here mutates; views are re-run queries.
//
//   add <emp> <date> <proj> <hours>          start a NEW entry
//   edit <#> <emp> <date> <proj> <hours>     correct current entry #<#> (any field)
//   list                                     current entries, numbered (for edit)
//   view                                     grid: employee x date, current hours/day
//   history <#>                              the edit chain of entry #<#>, oldest -> current
//   log / open / help / quit

import { Graph, Node, Tree } from "../graph.ts";
import { renderData } from "../viz.ts";
import * as readline from "node:readline";
import { execFile } from "node:child_process";

const DATA = "ReversibleFunctionGraph2/data.js";
const HTML = "ReversibleFunctionGraph2/graph.html";
const g = new Graph();

// a record is "emp|date|proj|hours" — each function chops out one field
g.def("emp",   rec => rec.split("|")[0]);
g.def("date",  rec => rec.split("|")[1]);
g.def("proj",  rec => rec.split("|")[2]);
g.def("hours", rec => rec.split("|")[3]);

// a date is itself "year-month-day" — chop one level deeper, guarded
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
g.def("year",  d => isDate(d) ? d.split("-")[0] : null);
g.def("month", d => isDate(d) ? d.split("-")[1] : null);
g.def("day",   d => isDate(d) ? d.split("-")[2] : null);

// edit(old, new) asserts "old was edited into new". Returns new (the winner),
// so the edge is  old -> edit(old,new) -> new.  Ordering = these edges.
g.def("edit", (_old, neu) => neu);

const FIELDS = ["emp", "date", "proj", "hours"];
const log: string[] = []; // every record ever appended (order here doesn't matter)

const nodes = (t: Tree): Node[] => t.items.filter(x => x instanceof Node) as Node[];
const field = (rec: string, f: string) => g.node(rec).apply(f).value;
const chop = (rec: string) => {                          // store a record's fields in the graph
  for (const f of FIELDS) g.node(rec).apply(f);
  const dateNode = g.node(rec).apply("date");
  for (const f of ["year", "month", "day"]) dateNode.apply(f);
};

// one step FORWARD along edits: the record that edited `rec`, or null if it's the tip
function nextOf(rec: string): string | null {
  for (const app of nodes(g.node(rec).to()))
    if (app.value.startsWith(`edit(${rec},`)) return nodes(app.to())[0].value;
  return null;
}
// one step BACK: the record `rec` was edited FROM, or null if it's the chain root
function prevOf(rec: string): string | null {
  for (const app of nodes(g.node(rec).from()))
    if (app.value.startsWith("edit(") && app.value.endsWith(`,${rec})`))
      return nodes(app.from()).map(n => n.value).find(v => !v.endsWith("()") && v !== rec) ?? null;
  return null;
}
// the chain ROOT of a record = its stable identity (walk edits all the way back)
function rootOf(rec: string): string {
  let cur = rec;
  for (let p = prevOf(cur); p; p = prevOf(cur)) cur = p;
  return cur;
}
// current entries = the chain tips (nothing edits them), ordered by their ROOT's
// original position — so an entry keeps its slot even after its tip changes.
function currentEntries(): string[] {
  const seen = new Set<string>(), tips: string[] = [];
  for (const r of log) if (nextOf(r) === null && !seen.has(r)) { seen.add(r); tips.push(r); }
  return tips.sort((a, b) => log.indexOf(rootOf(a)) - log.indexOf(rootOf(b)));
}
// the whole edit chain ending at `tip`, oldest -> tip
function chainOf(tip: string): string[] {
  const out = [tip];
  for (let cur = prevOf(tip); cur; cur = prevOf(cur)) out.unshift(cur);
  return out;
}

function addEntry(emp: string, date: string, proj: string, hours: string): void {
  const rec = [emp, date, proj, hours].join("|");
  chop(rec);
  log.push(rec);                                         // a new chain root — no edit edge
  renderData(g, DATA);
  console.log(`  added: ${emp} ${date} ${proj} ${hours}h`);
}

// edit an ENTIRE row into an entire edited row. The old row must be a CURRENT
// entry (you correct what's live, not a stale version); the new row is anything.
function editRow(oldRec: string, newRec: string): void {
  if (!currentEntries().includes(oldRec)) {
    console.log(`  "${oldRec.replace(/\|/g, " ")}" is not a current entry (see 'list')`); return;
  }
  if (newRec === oldRec) { console.log("  no change"); return; }
  chop(newRec);
  g.node(oldRec).apply("edit", newRec);                 // draw the edit edge: old -> new
  log.push(newRec);
  renderData(g, DATA);
  console.log(`  edited:  ${oldRec.replace(/\|/g, " ")}  ->  ${newRec.replace(/\|/g, " ")}`);
}

function view(): void {
  const cell = new Map<string, number>(), emps = new Set<string>(), dates = new Set<string>();
  for (const r of currentEntries()) {                   // auto-resolves to current tips
    const e = field(r, "emp"), d = field(r, "date");
    emps.add(e); dates.add(d);
    cell.set(`${e}|${d}`, (cell.get(`${e}|${d}`) ?? 0) + Number(field(r, "hours")));
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
  const cur = currentEntries();
  if (!cur.length) { console.log("  (empty)"); return; }
  cur.forEach((r, i) => console.log(`  [${i}]  ${r.replace(/\|/g, "  ")}`));
}

function history(idx: number): void {
  const tip = currentEntries()[idx];
  if (tip === undefined) { console.log(`  no current entry #${idx}`); return; }
  const ch = chainOf(tip);
  console.log(`  entry #${idx} — ${ch.length} version(s), oldest first:`);
  ch.forEach((r, i) =>
    console.log(`     ${i === ch.length - 1 ? "* " : "  "}${r.replace(/\|/g, "  ")}${i === ch.length - 1 ? "   (current)" : ""}`));
}

function openBrowser(): void {
  renderData(g, DATA);
  execFile("xdg-open", [HTML], err => { if (err) console.log(`  (open ${HTML} yourself)`); });
  console.log(`  opened ${HTML} — reload after each add/edit`);
}

const HELP = `commands:
  add <emp> <date> <proj> <hours>                        start a NEW entry
  edit <emp date proj hours> -> <emp date proj hours>    edit a whole row into an edited row
  list                                                   current entries (copy a row to edit it)
  view                                                   grid: employee x date, current hours/day
  history <#>                                            the edit chain of entry #<#>
  log                                                    every record ever (order lives in edges)
  open / help / quit`;

function handle(line: string): void {
  const [cmd, ...a] = line.split(/\s+/).filter(Boolean);
  switch (cmd) {
    case undefined: return;
    case "add":
      if (a.length !== 4) { console.log("  usage: add <emp> <date> <proj> <hours>"); return; }
      addEntry(a[0], a[1], a[2], a[3]); return;
    case "edit": {
      const i = a.indexOf("->");                        // split old row  ->  new row
      if (i !== 4 || a.length !== 9) {
        console.log("  usage: edit <emp date proj hours> -> <emp date proj hours>"); return;
      }
      editRow(a.slice(0, 4).join("|"), a.slice(5).join("|")); return;
    }
    case "list": list(); return;
    case "view": view(); return;
    case "history":
      if (a.length !== 1) { console.log("  usage: history <#>"); return; }
      history(+a[0]); return;
    case "log":
      if (!log.length) { console.log("  (empty)"); return; }
      log.forEach((r, i) => console.log(`  #${i + 1}  ${r.replace(/\|/g, "  ")}`)); return;
    case "open": case "graph": openBrowser(); return;
    case "help": console.log(HELP); return;
    case "quit": case "exit": rl.close(); return;
    default: console.log(`  unknown: "${cmd}".  type "help".`);
  }
}

// seed some entries (your values — the 11/12 hours still collide with months)
addEntry("bob",   "2026-08-25", "projX", "8");
addEntry("bob",   "2026-08-25", "projY", "12");
addEntry("alice", "2026-11-25", "projX", "11");
addEntry("bob",   "2026-12-26", "projX", "4");
addEntry("carol", "2026-08-26", "projY", "7");
addEntry("alice", "2026-08-26", "projX", "12");
console.log("\ntimesheet — 'add' starts an entry; edit a whole row into an edited row:");
console.log("try:  edit bob 2026-08-25 projX 8 -> bob 2026-08-25 projZ 6\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "timesheet> " });
rl.prompt();
rl.on("line", line => { handle(line.trim()); rl.prompt(); });
rl.on("close", () => { console.log("bye"); process.exit(0); });
