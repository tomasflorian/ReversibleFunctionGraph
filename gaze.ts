import type { Graph } from "./graph.ts";

export type Cell = { s: string; c: string; res: string; app: string };
export type Pivot = { subjects: string[]; columns: string[]; cells: Cell[] };
export type Table = { cols: string[]; rows: string[] };
export type Link = { fn: string; from: string; to: string; app: string };
export type Chain = { fn: string; nodes: string[] };
export type Listing = { fn: string; from: string; items: string[] };

export function pivot(g: Graph): Pivot {
  const subjects: string[] = [], columns: string[] = [], cells: Cell[] = [];
  const seenS = new Set<string>(), seenC = new Set<string>();

  for (const app of g.all()) {
    if (app.roleName !== "application") continue;
    const inputs = app.from().nodes;
    const out = app.to().nodes[0];
    if (inputs.length < 2 || out === undefined) continue;

    const fnName = inputs[0].value.replace(/\(\)$/, "");
    const subject = inputs[1].value;
    const extra = inputs.slice(2).map(n => n.value);
    const col = extra.length ? `${fnName}(·,${extra.join(",")})` : fnName;

    cells.push({ s: subject, c: col, res: out.value, app: app.value });
    if (!seenS.has(subject)) { seenS.add(subject); subjects.push(subject); }
    if (!seenC.has(col)) { seenC.add(col); columns.push(col); }
  }
  // canonical order: cells too, not just the axes — see view.ts snapshot().
  subjects.sort(); columns.sort();
  cells.sort((a, b) => a.s.localeCompare(b.s) || a.c.localeCompare(b.c));
  return { subjects, columns, cells };
}

export function tables(p: Pivot): Table[] {
  const key = (s: string, c: string) => s + "\u0000" + c;
  const has = new Set(p.cells.map(c => key(c.s, c.c)));
  const groups = new Map<string, Table>();
  for (const s of p.subjects) {
    const cols = p.columns.filter(c => has.has(key(s, c)));
    if (!cols.length) continue;
    const sig = cols.join("\u0000");
    if (!groups.has(sig)) groups.set(sig, { cols, rows: [] });
    groups.get(sig)!.rows.push(s);
  }
  // biggest first, then a name tiebreak so ties don't ride on insertion order.
  return [...groups.values()].sort((a, b) =>
    b.rows.length - a.rows.length || b.cols.length - a.cols.length ||
    a.rows[0].localeCompare(b.rows[0]));
}

// ---------------------------------------------------------------------------
// LINKS — calls that return one of their own arguments.
//
// Most calls compute: length("paris") -> "5" mints a value that was not there
// before. Some calls do not compute; they RELATE. `elem` is written
// (list, part) => part and `edit` is written (old, neu) => neu, so the call
// hands back something it was already given. What such a call leaves in the
// graph is an edge between two values that both already existed.
//
// Reading them off costs nothing that is not already stored: the application
// node holds its arguments and its result, so "the result is one of the extra
// arguments" is a question the graph can be asked directly.
export function links(g: Graph): Link[] {
  const out: Link[] = [];
  for (const app of g.all()) {
    if (app.roleName !== "application") continue;
    const inputs = app.from().nodes;
    const res = app.to().nodes[0];
    if (inputs.length < 3 || res === undefined) continue;

    const fn = inputs[0].value.replace(/\(\)$/, "");
    const from = inputs[1].value;
    const extra = inputs.slice(2).map(n => n.value);
    if (from === res.value || !extra.includes(res.value)) continue;

    out.push({ fn, from, to: res.value, app: app.value });
  }
  out.sort((a, b) => a.fn.localeCompare(b.fn) || a.from.localeCompare(b.from) ||
                     a.to.localeCompare(b.to));
  return out;
}

// ---------------------------------------------------------------------------
// CHAINS — links, per function, that COMPOSE.
//
// The links of one function fall into one of two arrangements, and the graph
// says which without being told:
//
//   `word`  — a list points at its words. No word is itself a list, so nothing
//             a `word` call points AT is ever the subject of another `word`
//             call. The relation is one hop deep and fans out.
//
//   `edit`  — a record points at its replacement, and that replacement is the
//             subject of the next `edit`. The relation composes; depth grows.
//
// The test is that second sentence, and it is a property of the relation, not
// of any single call: does some node appear on BOTH ends of this function's
// links? When it does, walk from every source that nothing points at and emit
// each maximal run. When it does not, this lens has nothing to say about that
// function and stays quiet — the fan-out arrangement is a different reading.
//
// Nothing here asks what a value IS. It asks how the edges lie.
export function chains(g: Graph): Chain[] {
  const byFn = new Map<string, Link[]>();
  for (const l of links(g)) (byFn.get(l.fn) ?? byFn.set(l.fn, []).get(l.fn)!).push(l);

  const out: Chain[] = [];
  for (const [fn, ls] of byFn) {
    const next = new Map<string, string[]>();
    const sources = new Set<string>(), targets = new Set<string>();
    for (const l of ls) {
      (next.get(l.from) ?? next.set(l.from, []).get(l.from)!).push(l.to);
      sources.add(l.from); targets.add(l.to);
    }
    if (![...sources].some(s => targets.has(s))) continue; // fans out; not a chain

    const roots = [...sources].filter(s => !targets.has(s)).sort();
    for (const root of roots) {
      const walk = (node: string, run: string[], seen: Set<string>): void => {
        const kids = (next.get(node) ?? []).filter(k => !seen.has(k)).sort();
        if (!kids.length) { out.push({ fn, nodes: [...run] }); return; }
        for (const k of kids) {
          run.push(k); seen.add(k);
          walk(k, run, seen);
          run.pop(); seen.delete(k);
        }
      };
      walk(root, [root], new Set([root]));
    }
  }
  out.sort((a, b) => a.fn.localeCompare(b.fn) || a.nodes[0].localeCompare(b.nodes[0]));
  return out;
}

// ---------------------------------------------------------------------------
// LISTINGS — links, per function, that DO NOT compose.
//
// The other arrangement, and by far the commoner one. `word` links a list to
// each of its words; nothing a `word` call points at is the subject of another
// `word` call, so the relation is one hop deep and fans out. Gathered by
// subject, that is a list and its members: five sentences become five blocks
// with their words under them, and a word two sentences share appears under
// both, because it is one node.
//
// This reads the same links `chains` reads and takes the other branch of the
// same test. It does not touch the pivot — `word(·,old)` still mints its
// column there exactly as before. This is a place to stand, not an edit to
// where anyone else was standing.
export function listings(g: Graph): Listing[] {
  const byKey = new Map<string, Listing>();
  for (const l of links(g)) {
    const key = l.fn + "\u0000" + l.from;
    const found = byKey.get(key) ?? { fn: l.fn, from: l.from, items: [] };
    found.items.push(l.to);
    byKey.set(key, found);
  }
  // keep only the fan-out relations; the composing ones are `chains`.
  const composes = new Set<string>();
  const srcs = new Map<string, Set<string>>(), tgts = new Map<string, Set<string>>();
  for (const l of links(g)) {
    (srcs.get(l.fn) ?? srcs.set(l.fn, new Set()).get(l.fn)!).add(l.from);
    (tgts.get(l.fn) ?? tgts.set(l.fn, new Set()).get(l.fn)!).add(l.to);
  }
  for (const [fn, s] of srcs) if ([...s].some(x => tgts.get(fn)?.has(x))) composes.add(fn);

  return [...byKey.values()]
    .filter(l => !composes.has(l.fn))
    .sort((a, b) => a.fn.localeCompare(b.fn) || a.from.localeCompare(b.from));
}

// ---------------------------------------------------------------------------
// THE LENSES — the readings view.ts ships and the viewer draws.
//
// One graph, several boundaries. A lens asserts nothing about the data; it
// picks where to stand and reports what is visible from there. Adding a
// reading is an entry here plus a renderer in graph.html — the store and the
// scenarios do not move.
export const LENSES: Record<string, (g: Graph) => unknown> = {
  pivot:    g => pivot(g),
  tables:   g => tables(pivot(g)),
  chains:   g => chains(g),
  listings: g => listings(g),
};
