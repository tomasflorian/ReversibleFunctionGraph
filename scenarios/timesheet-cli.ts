// timesheet-cli.ts — INTERACTIVE console timesheet, written on the ergo window.
//   npx tsx ReversibleFunctionGraph2/scenarios/timesheet-cli.ts
//
// Same graph as before, but the raw plumbing (chop loops, .apply(f).value,
// nextOf/prevOf string-parsing) is gone — it lives in ergo.ts now. This file is
// just domain logic: entries are records, corrections are edits, current is the
// tip of an edit chain, views auto-resolve. Nothing mutates; views are queries.
//
//   add <emp> <date> <proj> <hours>                        start a NEW entry
//   edit <emp date proj hours> -> <emp date proj hours>    edit a whole row into an edited row
//   list                                                   current entries (copy a row to edit it)
//   view                                                   grid: employee x date, current hours/day
//   history <#>                                            the edit chain of entry #<#>
//   log / open / help / quit

import { Graph } from "../graph.ts";
import { ergo } from "../ergo.ts";
import { renderData } from "../viz.ts";
import * as readline from "node:readline";
import { execFile } from "node:child_process";

const DATA = "ReversibleFunctionGraph2/data.js";
const HTML = "ReversibleFunctionGraph2/graph.html";

const g = new Graph();
const e = ergo(g);

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const Entry = e.record("|", ["emp", "date", "proj", "hours"]); // an entry
const Day   = e.record("-", ["year", "month", "day"], isDate); // a date, chopped deeper
const edit  = e.versioned("edit");                             // correction chains

const log: string[] = []; // every record appended (order here is irrelevant)

// store a record fully: its fields, and its date one level deeper
const store = (rec: string) => { Entry.chop(rec); Day.chop(Entry.read(rec, "date")); };

// current entries = chain tips (nothing edits them), unique, ordered by their
// chain ROOT's position — so an entry keeps its slot even after its tip changes.
function current(): string[] {
  const seen = new Set<string>(), tips: string[] = [];
  for (const r of log) if (edit.next(r) === null && !seen.has(r)) { seen.add(r); tips.push(r); }
  return tips.sort((a, b) => log.indexOf(edit.root(a)) - log.indexOf(edit.root(b)));
}

function addEntry(emp: string, date: string, proj: string, hours: string): void {
  const rec = Entry.make(emp, date, proj, hours);
  store(rec);
  log.push(rec);
  renderData(g, DATA);
  console.log(`  added: ${emp} ${date} ${proj} ${hours}h`);
}

function editRow(oldRec: string, newRec: string): void {
  if (!current().includes(oldRec)) {
    console.log(`  "${oldRec.replace(/\|/g, " ")}" is not a current entry (see 'list')`); return;
  }
  if (newRec === oldRec) { console.log("  no change"); return; }
  store(newRec);
  edit.apply(oldRec, newRec);                              // one edge; that's the whole correction
  log.push(newRec);
  renderData(g, DATA);
  console.log(`  edited:  ${oldRec.replace(/\|/g, " ")}  ->  ${newRec.replace(/\|/g, " ")}`);
}

function view(): void {
  const cell = new Map<string, number>(), emps = new Set<string>(), dates = new Set<string>();
  for (const r of current()) {                            // auto-resolves to tips
    const em = Entry.read(r, "emp"), d = Entry.read(r, "date");
    emps.add(em); dates.add(d);
    cell.set(`${em}|${d}`, (cell.get(`${em}|${d}`) ?? 0) + Number(Entry.read(r, "hours")));
  }
  const E = [...emps].sort(), D = [...dates].sort();
  if (!E.length) { console.log("  (no entries yet — try: add bob 2026-08-25 projX 8)"); return; }
  const w = Math.max(8, ...E.map(x => x.length));
  const head = "employee".padEnd(w) + " | " + D.join(" | ");
  console.log("  " + head);
  console.log("  " + "-".repeat(head.length));
  for (const em of E)
    console.log("  " + em.padEnd(w) + " | " +
      D.map(d => String(cell.get(`${em}|${d}`) ?? "·").padStart(d.length)).join(" | "));
}

function list(): void {
  const cur = current();
  if (!cur.length) { console.log("  (empty)"); return; }
  cur.forEach((r, i) => console.log(`  [${i}]  ${r.replace(/\|/g, "  ")}`));
}

function history(idx: number): void {
  const tip = current()[idx];
  if (tip === undefined) { console.log(`  no current entry #${idx}`); return; }
  const chain = edit.chain(tip);
  console.log(`  entry #${idx} — ${chain.length} version(s), oldest first:`);
  chain.forEach((r, i) =>
    console.log(`     ${i === chain.length - 1 ? "* " : "  "}${r.replace(/\|/g, "  ")}${i === chain.length - 1 ? "   (current)" : ""}`));
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
      const i = a.indexOf("->");                          // split old row  ->  new row
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

// seed some entries (your values — 11/12 hours still collide with months)
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
