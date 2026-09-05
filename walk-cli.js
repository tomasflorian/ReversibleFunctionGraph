#!/usr/bin/env node
// walk-cli.js — the walk tab, without the tab.
//
// walk.js takes {nodes, edges}, which is exactly what every file in snapshots/
// already is, so the same walk the viewer does can be run over any snapshot from
// here. That is what keeps the walk checkable even though it is computed live and
// never lands in a snapshot of its own.
//
//   node walk-cli.js timesheet emp                    # anchor column, and what it offers
//   node walk-cli.js timesheet emp rev_emp date +hours
//   node walk-cli.js text word rev_word word
//
// Steps read left to right. A step hangs off the previous one; a step written
// with a leading + hangs off the same parent as the previous one, which is how
// you branch:
//
//   rev_emp date +hours     ->  date() via rev_emp()  and  hours() via rev_emp()
//                               two branches of one step, pairing at the record

const fs = require("fs");
const path = require("path");
const WALK = require("./walk.js");

const [file, anchor, ...steps] = process.argv.slice(2);
if (!file || !anchor) {
  console.error("usage: node walk-cli.js <snapshot|path> <anchorFn> [step ...]");
  console.error("       a step is fn or rev_fn; prefix + to branch off the same parent");
  process.exit(1);
}

const p = fs.existsSync(file) ? file : path.join("snapshots", file + ".js");
if (!fs.existsSync(p)) { console.error("no such graph: " + p); process.exit(1); }
global.window = {};
new Function("window", fs.readFileSync(p, "utf8"))(global.window);

const index = WALK.buildIndex(global.window.GRAPH);

if (!WALK.anchorFunctions(index).includes(anchor)) {
  console.error(`no function "${anchor}" produced anything here.`);
  console.error("functions: " + WALK.anchorFunctions(index).join(", "));
  process.exit(1);
}

const tree = WALK.newTree(anchor);
let last = tree.header, parent = tree.header;
for (const raw of steps) {
  const branch = raw[0] === "+";
  const name = branch ? raw.slice(1) : raw;
  const dir = name.indexOf("rev_") === 0 ? "rev" : "fwd";
  const fn = name.replace(/^rev_/, "").replace(/\(\)$/, "");
  const under = branch ? parent : last;
  const child = WALK.addStep(tree, under, { dir: dir, fn: fn });
  if (!child) { console.error(`cannot add ${name} under ${under}`); process.exit(1); }
  parent = under;
  last = child.header;
}

const t = WALK.tabulate(index, tree, { maxRows: Number(process.env.WALK_MAX) || 2000 });

const cell = (r, c) => (r[c] ? WALK.qualified(r[c]) : "?");
const w = t.columns.map(c => Math.max(c.length, ...t.rows.map(r => cell(r, c).length)));
console.log(t.columns.map((c, i) => c.padEnd(w[i])).join(" | "));
console.log(w.map(x => "-".repeat(x)).join("-+-"));
for (const r of t.rows) console.log(t.columns.map((c, i) => cell(r, c).padEnd(w[i])).join(" | "));
console.log(`\n${t.rows.length} row(s), ${t.columns.length} column(s)` +
            (t.capped ? " — CAPPED" : ""));

// what the last column can reach, so you know what to tick next
const leafValues = [...new Set(t.rows.map(r => r[last] && r[last].value).filter(Boolean))];
const offers = new Set();
for (const v of leafValues) for (const s of WALK.stepsFrom(index, v)) offers.add(WALK.stepName(s));
if (offers.size) console.log(`from ${last}: ` + [...offers].sort().join(" "));
