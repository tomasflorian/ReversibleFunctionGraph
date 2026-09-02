// timesheet-cli.ts — INTERACTIVE console timesheet on the ergo window.
//   npx tsx scenarios/timesheet-cli.ts
//
// Nodes are shown RAW (pipe-delimited) everywhere, so you can copy a line from
// `list`/`log` straight into `edit`. `edit` is fully generic: edit <old> -> <new>
// for ANY two strings — a whole row, a single value, anything. It just draws the
// edit edge; it knows nothing about schema. Views resolve by walking edits from
// each log root to its current tip, so an edit updates the view with no fuss.
//
//   add <emp> <date> <proj> <hours>        start a NEW entry (a root)
//   edit <old> -> <new>                    edit any raw string into any raw string
//   history <node>                         the edit chain through a raw node
//   list                                   current entries, raw (copy one to edit it)
//   view                                   grid: employee x date, current hours/day
//   log / open / help / quit

import { Graph } from "../graph.ts";
import { ergo } from "../ergo.ts";
import { renderData } from "../view.ts";
import * as readline from "node:readline";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const DATA = new URL("../data.js", import.meta.url);
const HTML = fileURLToPath(new URL("../graph.html", import.meta.url));

const g = new Graph();
const e = ergo(g);

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const Entry = e.record("|", ["emp", "date", "proj", "hours"]);
const Day   = e.record("-", ["year", "month", "day"], isDate);
const edit  = e.versioned("edit");

const log: string[] = []; // the roots we've added (chain starts)

// current entries = for each root, its current tip (walk edits forward)
function current(): string[] {
  const seen = new Set<string>(), roots: string[] = [];
  for (const r of log) if (edit.prev(r) === null && !seen.has(r)) { seen.add(r); roots.push(r); }
  return roots.map(r => edit.tip(r));
}

function addEntry(emp: string, date: string, proj: string, hours: string): void {
  const rec = Entry.make(emp, date, proj, hours);
  Entry.chop(rec); Day.chop(Entry.read(rec, "date"));   // eager-chop a new root
  log.push(rec);
  renderData(g, DATA);
  console.log(`  added: ${rec}`);
}

// GENERIC edit — any raw string into any raw string. Just draws the edge.
function editAny(oldRaw: string, newRaw: string): void {
  if (oldRaw === newRaw) { console.log("  no change"); return; }
  edit.apply(oldRaw, newRaw);
  renderData(g, DATA);
  console.log(`  edited: ${oldRaw}  ->  ${newRaw}`);
}

function view(): void {
  const cell = new Map<string, number>(), emps = new Set<string>(), dates = new Set<string>();
  for (const r of current()) {
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
  cur.forEach(r => console.log("  " + r));            // RAW — copy one into `edit`
}

function history(node: string): void {
  const chain = edit.chain(node);
  console.log(`  ${chain.length} version(s), oldest first:`);
  chain.forEach((r, i) => console.log(`     ${i === chain.length - 1 ? "* " : "  "}${r}`));
}

function openBrowser(): void {
  renderData(g, DATA);
  execFile("xdg-open", [HTML], err => { if (err) console.log(`  (open ${HTML} yourself)`); });
  console.log(`  opened ${HTML} — reload after each add/edit`);
}

const HELP = `commands:
  add <emp> <date> <proj> <hours>    start a NEW entry (a root)
  edit <old> -> <new>                edit any raw string into any raw string
  history <node>                     the edit chain through a raw node
  list                               current entries, raw (copy one to edit it)
  view                               grid: employee x date, current hours/day
  log                                every root added, raw
  open / help / quit`;

function handle(line: string): void {
  const trimmed = line.trim();
  const [cmd, ...a] = trimmed.split(/\s+/).filter(Boolean);
  switch (cmd) {
    case undefined: return;
    case "add":
      if (a.length !== 4) { console.log("  usage: add <emp> <date> <proj> <hours>"); return; }
      addEntry(a[0], a[1], a[2], a[3]); return;
    case "edit": {
      const body = trimmed.replace(/^edit\s+/, "");
      const parts = body.split(" -> ");                // raw old  ->  raw new (verbatim)
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.log("  usage: edit <old> -> <new>   (raw strings, e.g. from `list`)"); return;
      }
      editAny(parts[0], parts[1]); return;
    }
    case "history": {
      const node = trimmed.replace(/^history\s+/, "");
      if (!node || node === "history") { console.log("  usage: history <node>"); return; }
      history(node); return;
    }
    case "list": list(); return;
    case "view": view(); return;
    case "log":
      if (!log.length) { console.log("  (empty)"); return; }
      log.forEach(r => console.log("  " + r)); return;
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
console.log("\ntimesheet — copy a raw row from `list` and edit it (any part):");
console.log("  edit bob|2026-08-25|projX|8 -> bob|2026-08-25|projZ|6\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "timesheet> " });
rl.prompt();
rl.on("line", line => { handle(line.trim()); rl.prompt(); });
rl.on("close", () => { console.log("bye"); process.exit(0); });
