// general.ts — a generic loader CLI. Ground truth is a list of RAW SOURCES
// (JSON / CSV). Replaying them chops everything into the graph; TABLES are gazed
// back out of the graph (never stored). Edit/delete = change a source and REBUILD
// from ground truth — the graph is a pure function of (sources + functions).
//   npx tsx general.ts
//
// There is ONE chopping path: extract-a-key from a JSON object. CSV is sugar —
// each row becomes an object, then chops the same way. Because CSV headers and
// JSON keys land under the SAME function name, sources MERGE when their keys
// match and stay separate when they don't — the data decides, not a schema.
//
// ────────────────────────────────────────────────────────────────────────────
// TRIPWIRE: every function here is PURE (parse/stringify/split — no g.apply
// inside an impl). That is what makes "throw the graph away and rebuild" clean:
// pure impls don't close over the graph, so replay against a fresh graph just
// works. The DAY you write a COMPOSITE function (an impl that calls g.apply to
// use another function), it will close over `g` and go stale on rebuild. That is
// the single signal to make the ~2-line core change: have `apply` pass the impl
// a context so impls call ctx.apply(...) instead of closing over a graph. Until
// then: keep impls pure and this file needs no core changes.
// ────────────────────────────────────────────────────────────────────────────

import { Graph } from "./graph.ts";
import { renderData } from "./viz.ts";
import * as readline from "node:readline";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const DATA = new URL("./data.js", import.meta.url);
const HTML = fileURLToPath(new URL("./graph.html", import.meta.url));
const SEP = "\u0000";

// ── ground truth ────────────────────────────────────────────────────────────
type Source = { kind: "json" | "csv"; raw: string };
const sources: Source[] = [];

// rebuilt fresh on every change:
let g = new Graph();
let columns = new Set<string>(); // every key/header seen — the gazes available

// ── the ONE chopping path: extract a key out of a JSON object ────────────────
function chopObject(obj: Record<string, unknown>): void {
  const s = JSON.stringify(obj);                       // the object's node = its JSON
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    g.def(key, (str: string) => {                      // PURE: parse, read this key
      const v = (JSON.parse(str) as Record<string, unknown>)[key];
      return v === undefined || v === null ? null
        : typeof v === "object" ? JSON.stringify(v) : String(v);
    });
    columns.add(key);
    g.node(s).apply(key);                              // obj ──▶ key(obj) ──▶ value
    if (val && typeof val === "object" && !Array.isArray(val))
      chopObject(val as Record<string, unknown>);      // nested object → its own sub-table
    else if (Array.isArray(val))
      for (const el of val) if (el && typeof el === "object") chopObject(el as Record<string, unknown>);
  }
}

function loadJSON(raw: string): void {
  const data = JSON.parse(raw);
  (Array.isArray(data) ? data : [data]).forEach(chopObject);
}
function loadCSV(raw: string): void {                   // sugar: rows → objects → chopObject
  const lines = raw.split(/[\n;]/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;
  const cols = lines[0].split(",").map(c => c.trim());
  for (const line of lines.slice(1)) {
    const vals = line.split(",");
    const obj: Record<string, string> = {};
    cols.forEach((c, i) => (obj[c] = (vals[i] ?? "").trim()));
    chopObject(obj);
  }
}

// ── REBUILD: the graph is a pure replay of the sources ───────────────────────
function rebuild(): void {
  g = new Graph();
  columns = new Set();
  for (const src of sources) {
    try { src.kind === "json" ? loadJSON(src.raw) : loadCSV(src.raw); }
    catch (err) { console.log(`  (skipped a bad ${src.kind} source: ${(err as Error).message})`); }
  }
  renderData(g, DATA);
}

// ── GAZE: reconstruct tables from the graph by column-signature ──────────────
function gazeTables(): void {
  const cols = [...columns];
  const cell = new Map<string, string>(), subjects: string[] = [], seen = new Set<string>();
  for (const c of cols)
    for (const app of g.node(c + "()").to().nodes) {
      const subject = app.from().nodes[1]?.value;   // inputs are [c(), subject]
      if (subject === undefined) continue;
      cell.set(subject + SEP + c, app.to().nodes[0]?.value ?? "");
      if (!seen.has(subject)) { seen.add(subject); subjects.push(subject); }
    }
  const groups = new Map<string, { cols: string[]; rows: string[] }>();
  for (const s of subjects) {
    const sig = cols.filter(c => cell.has(s + SEP + c));
    if (!sig.length) continue;
    const key = sig.join(SEP);
    (groups.get(key) ?? groups.set(key, { cols: sig, rows: [] }).get(key)!).rows.push(s);
  }
  const list = [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
  if (!list.length) { console.log("  (no tables — load something first)"); return; }
  console.log(`  ${list.length} table(s) reconstructed from the graph:`);
  list.forEach((grp, i) => {
    const rows = grp.rows.map(s => grp.cols.map(c => cell.get(s + SEP + c) ?? ""));
    const w = grp.cols.map((c, k) => Math.max(c.length, ...rows.map(r => r[k].length), 1));
    console.log(`\n  table ${i + 1}  (${grp.rows.length} rows)`);
    console.log("    " + grp.cols.map((c, k) => c.padEnd(w[k])).join(" | "));
    console.log("    " + w.map(x => "-".repeat(x)).join("-+-"));
    for (const r of rows) console.log("    " + r.map((v, k) => v.padEnd(w[k])).join(" | "));
  });
}

function sourcesList(): void {
  if (!sources.length) { console.log("  (no sources)"); return; }
  sources.forEach((s, i) => console.log(`  [${i}] ${s.kind}  ${s.raw}`));
}

function openBrowser(): void {
  renderData(g, DATA);
  execFile("xdg-open", [HTML], err => { if (err) console.log(`  (open ${HTML} yourself)`); });
  console.log(`  opened ${HTML} — reload after each change`);
}

const HELP = `commands:
  loadjson <json>          add a JSON source (array of objects, or one object)
  loadcsv <csv>            add a CSV source (rows separated by ; or newline)
  tables                   reconstruct all tables from the graph (a gaze)
  sources                  list the raw sources (ground truth), numbered
  edit <#> <newraw>        replace source #<#>'s raw, then rebuild
  drop <#>                 remove source #<#>, then rebuild
  rebuild                  replay ground truth from scratch (it's deterministic)
  open / help / quit`;

function handle(line: string): void {
  const t = line.trim();
  const [cmd, ...a] = t.split(/\s+/).filter(Boolean);
  const rest = (kw: string) => t.replace(new RegExp(`^${kw}\\s+`), "");
  switch (cmd) {
    case undefined: return;
    case "loadjson": { const raw = rest("loadjson"); if (!raw) return void console.log("  usage: loadjson <json>");
      sources.push({ kind: "json", raw }); rebuild(); console.log(`  loaded json (${sources.length - 1})`); return; }
    case "loadcsv": { const raw = rest("loadcsv"); if (!raw) return void console.log("  usage: loadcsv <csv>");
      sources.push({ kind: "csv", raw }); rebuild(); console.log(`  loaded csv (${sources.length - 1})`); return; }
    case "tables": gazeTables(); return;
    case "sources": sourcesList(); return;
    case "edit": {
      const idx = +a[0], raw = rest("edit").replace(/^\S+\s+/, "");  // "edit <#> <newraw>"
      if (!sources[idx] || !raw) return void console.log("  usage: edit <#> <newraw>");
      sources[idx].raw = raw; rebuild(); console.log(`  edited source ${idx}, rebuilt`); return;
    }
    case "drop": {
      const idx = +a[0];
      if (!sources[idx]) return void console.log("  usage: drop <#>");
      sources.splice(idx, 1); rebuild(); console.log(`  dropped source ${idx}, rebuilt`); return;
    }
    case "rebuild": rebuild(); console.log("  rebuilt from ground truth"); return;
    case "open": case "graph": openBrowser(); return;
    case "help": console.log(HELP); return;
    case "quit": case "exit": rl.close(); return;
    default: console.log(`  unknown: "${cmd}".  type "help".`);
  }
}

// seed: a CSV and two JSON sources — one that MERGES with the CSV (same keys),
// one NESTED (a tree → a parent table + a sub-table).
sources.push({ kind: "csv",  raw: "first,last;alice,jones;bob,smith" });
sources.push({ kind: "json", raw: '[{"first":"carol","last":"white"},{"first":"dave","last":"green"}]' });
sources.push({ kind: "json", raw: '[{"ip":"10.0.0.1","geo":{"city":"paris","country":"fr"}}]' });
rebuild();
console.log("\ngeneral loader — try:  tables   then   sources   then   drop 0   then   tables\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "general> " });
rl.prompt();
rl.on("line", line => { handle(line.trim()); rl.prompt(); });
rl.on("close", () => { console.log("bye"); process.exit(0); });
