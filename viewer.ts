// viewer.ts — the viewer's behaviour. graph.html is the markup and the styles;
// this is everything that happens.
//
// ATOMS COME FROM TWO PLACES. The pile, over a live stream, and a paste box.
// Which of them is in play is a switch on the left, and the switch is the only
// thing kept between visits — atoms are never stored in the browser. Pasted
// atoms live as long as the tab does.
//
// The picture is a tab, and IT IS NOT BUILT UNTIL YOU OPEN IT. Atoms are still
// collected and expanded while it is closed, because that is cheap; laying out a
// thousand nodes is not, and there is no reason to pay for it while you are
// reading a table. Nothing else depends on the network existing — the triples
// tab reads the edges directly.

import * as EXPAND from "./expand.js";
import * as WALK from "./walk.js";

// vis-network arrives as a global from a <script> tag in the page, and ships no
// types we depend on. This is the whole of its surface here.
declare const vis: any;

// Every element this file touches is in graph.html, so a missing one is a bug in
// the page rather than a case to handle.
const el = (id: string): HTMLElement => document.getElementById(id)!;

// How a node is DRAWN. "function" is not a kind of node — it is a node that
// filled some call's fn slot, which is a fact about an edge.
type Role = "value" | "function" | "application";

interface ViewNode { id: string; label: string; role: Role }

type View = "walk" | "triples" | "graph";
type Source = "server" | "pasted" | "both";

const COLORS: Record<Role, string> =
  { value: "#2b6cb0", function: "#805ad5", application: "#dd6b20" };
const SHAPES: Record<Role, string> =
  { value: "box", function: "box", application: "ellipse" };
const DIM = "#2a2a2a", DIM_FONT = "#555", DIM_EDGE = "#333", HOT_EDGE = "#fff";

// ---------------------------------------------------------------------------
// where atoms come from

const serverAtoms: EXPAND.Atom[] = [];
let pastedAtoms: EXPAND.Atom[] = [];

// The preference is remembered. The atoms are not — this is a window onto a
// pile, not a copy of one.
const SOURCE_KEY = "rfg.source";
let source: Source = read();

function read(): Source {
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    if (v === "server" || v === "pasted" || v === "both") return v;
  } catch { /* private window, blocked storage — the default is fine */ }
  return "server";
}

function remember(v: Source): void {
  try { localStorage.setItem(SOURCE_KEY, v); } catch { /* not important enough to fail over */ }
}

const atoms = (): EXPAND.Atom[] =>
  source === "server" ? serverAtoms
  : source === "pasted" ? pastedAtoms
  : serverAtoms.concat(pastedAtoms);

// ---------------------------------------------------------------------------
// the graph, derived
//
// Rebuilt from whichever atoms are in play. This is a plain recomputation and
// not a merge or a diff, because expand reads only the atom and never the graph
// built so far — so any set of atoms produces its graph in one pass, and a
// changed set just produces a different one.

const data: { nodes: ViewNode[]; edges: EXPAND.GraphEdge[] } = { nodes: [], edges: [] };
const nodeAt = new Map<string, ViewNode>();
const base = new Map<string, string>();
const inTo = new Map<string, EXPAND.GraphEdge[]>();    // node -> edges arriving
const outOf = new Map<string, EXPAND.GraphEdge[]>();   // node -> edges leaving
let wIndex = WALK.buildIndex([]);

function derive(): void {
  const built = EXPAND.expand(atoms());
  if (built.problems.length) console.warn("expand:", built.problems);

  data.nodes = built.nodes.map(n => ({
    id: n.id,
    label: n.label,
    role: n.role === "application" ? "application" : (n.isFn ? "function" : "value"),
  }));
  data.edges = built.edges;

  nodeAt.clear(); base.clear(); inTo.clear(); outOf.clear();
  for (const n of data.nodes) { nodeAt.set(n.id, n); base.set(n.id, COLORS[n.role]); }
  for (const e of data.edges) {
    (inTo.get(e.to) ?? inTo.set(e.to, []).get(e.to)!).push(e);
    (outOf.get(e.from) ?? outOf.set(e.from, []).get(e.from)!).push(e);
  }

  wIndex = WALK.buildIndex(atoms());

  for (const s of [...seeds]) if (!nodeAt.has(s)) seeds.delete(s);
  if (network) paint(true);
  el("empty").style.display = data.nodes.length ? "none" : "block";
  status();
  renderRight();
}

// ---------------------------------------------------------------------------
// the picture, built on demand

let network: any = null;
let nodes: any = null;
let edges: any = null;
let following = true;

function build(): void {
  if (network) return;
  nodes = new vis.DataSet([]);
  edges = new vis.DataSet([]);
  network = new vis.Network(el("net"), { nodes, edges }, {
    nodes: { font: { color: "#fff" } },
    edges: { arrows: "to", color: "#888" }, // unlabeled: direction only
    physics: { barnesHut: { springLength: 130 } }, // "push apart and settle"
    interaction: {
      // scroll wheel off; drive zoom/pan from the KEYBOARD instead.
      //   arrows -> pan,  [ -> zoom out,  ] -> zoom in
      zoomView: false,
      keyboard: { enabled: true, bindToWindow: true, speed: { x: 12, y: 12, zoom: 0.04 } },
    },
  });
  network.on("dragStart", () => (following = false));
  network.on("zoom", () => (following = false));
  network.on("stabilized", () => { if (following) network.fit(); });
  network.on("click", (params: { nodes: string[] }) => {
    if (params.nodes.length) selectNode(params.nodes[0]);
    else clearSelection();
  });
  paint(true);
}

/// Push the derived graph into vis. `whole` replaces everything, which is what a
/// changed source calls for; otherwise only what is missing is added, so a
/// streaming arrival does not throw away the layout.
function paint(whole: boolean): void {
  if (!network) return;
  if (whole) { nodes.clear(); edges.clear(); }
  const have = new Set<string>(whole ? [] : nodes.getIds());
  const haveE = new Set<string>(whole ? [] : edges.getIds());
  nodes.add(data.nodes.filter(n => !have.has(n.id)).map(n => ({
    id: n.id, label: n.label, color: base.get(n.id), shape: SHAPES[n.role],
  })));
  edges.add(data.edges
    .map(e => ({ id: e.from + " " + e.to + " " + e.slot, from: e.from, to: e.to, slot: e.slot }))
    .filter(e => !haveE.has(e.id)));
  render();
  if (following) network.fit();
}

// ---------------------------------------------------------------------------
// selection — shared by every tab
//
// `seeds` are the clicked nodes. In single mode a click replaces them; in multi
// mode a click adds. render() lights each seed and its neighbours and dims the
// rest. It only touches the picture, so it is a no-op while the graph is closed.

let multi = false;
const seeds = new Set<string>();

function render(): void {
  if (!network) return;
  if (seeds.size === 0) {
    nodes.update(data.nodes.map(n => ({
      id: n.id, color: base.get(n.id), font: { color: "#fff" }, borderWidth: 1,
    })));
    edges.update(edges.getIds().map((id: string) => ({ id, color: "#888" })));
    return;
  }
  const keep = new Set<string>(), hot = new Set<string>();
  for (const s of seeds) {
    keep.add(s);
    for (const e of inTo.get(s) ?? []) { keep.add(e.from); hot.add(edgeId(e)); }
    for (const e of outOf.get(s) ?? []) { keep.add(e.to); hot.add(edgeId(e)); }
  }
  nodes.update(data.nodes.map(n => keep.has(n.id)
    ? { id: n.id, color: base.get(n.id), font: { color: "#fff" },
        borderWidth: seeds.has(n.id) ? 4 : 1 }
    : { id: n.id, color: DIM, font: { color: DIM_FONT }, borderWidth: 1 }));
  edges.update(edges.getIds().map((eid: string) => ({
    id: eid, color: hot.has(eid) ? HOT_EDGE : DIM_EDGE,
  })));
}

const edgeId = (e: EXPAND.GraphEdge): string => e.from + " " + e.to + " " + e.slot;

function selectNode(id: string): void {
  if (!multi) seeds.clear();
  seeds.has(id) ? seeds.delete(id) : seeds.add(id);
  render();
  renderRight();
}

function clearSelection(): void {
  seeds.clear();
  render();
  renderRight();
}

// ---------------------------------------------------------------------------
// the right pane

const viewEl = el("view");
const selected = (): string | null => (seeds.size ? [...seeds][seeds.size - 1] : null);

const roleOf = (id: string): Role => nodeAt.get(id)?.role ?? "value";
// A node's ID is not for reading. A value's id happens to be its text, but a
// call's is its argument list, so everything shown to a person goes through the
// label and everything that navigates goes through the id.
const show = (nid: string): string => nodeAt.get(nid)?.label ?? nid;

const ESCAPES: Record<string, string> =
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string): string => String(s).replace(/[&<>"']/g, c => ESCAPES[c]);
const dot = (role: Role): string =>
  `<span class="dot" style="background:${COLORS[role]}"></span>`;
const isApp = (nid: string): boolean => roleOf(nid) === "application";

// a clickable node chip (dot + label); navigates on click via its data-id
const chip = (nid: string): string =>
  `<span class="node" data-id="${esc(nid)}">${dot(roleOf(nid))}${esc(show(nid))}</span>`;

// TRIPLES — what a node is, from the graph's own side. Reads the edges rather
// than the picture, so it works with the graph tab never opened.
function renderTriples(id: string | null): string {
  if (!id) {
    return `<div class="hint">Nothing selected. Open the <b>graph</b> tab and click a node, ` +
           `or click any chip once something is here.</div>`;
  }
  const head = `<div class="head">${dot(roleOf(id))}<b>${esc(show(id))}</b>` +
    `<span class="role">${roleOf(id)}</span></div>`;

  const resultOf = (app: string): string | undefined =>
    (outOf.get(app) ?? []).find(e => e.slot === "result")?.to;

  const triple = (app: string): string => {
    const res = resultOf(app);
    return `<li>${chip(app)}<span class="arrow">→</span>` +
      (res === undefined ? `<span class="empty">?</span>` : chip(res)) + `</li>`;
  };
  const triples = (apps: string[]): string => apps.length
    ? apps.map(triple).join("") : `<li class="empty">none</li>`;

  if (isApp(id)) {
    // Inputs in slot order with the slot named — which is what an atom knew all
    // along and the old picture could not say: which argument was first, and
    // which arrow was the function.
    const ins = (inTo.get(id) ?? []).slice()
      .sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));
    const rows = ins.length
      ? ins.map(e => `<li><span class="role">${esc(e.slot)}</span> ${chip(e.from)}</li>`).join("")
      : `<li class="empty">none</li>`;
    return head + `<h3>this call</h3><ul>${triple(id)}</ul>` +
      `<h3>inputs · ${ins.length}</h3><ul>${rows}</ul>`;
  }

  const producedBy = (inTo.get(id) ?? []).map(e => e.from).filter(isApp);
  const usedIn = (outOf.get(id) ?? []).map(e => e.to).filter(isApp);
  return head +
    `<h3>produced by · ${producedBy.length}</h3><ul>${triples(producedBy)}</ul>` +
    `<h3>used in · ${usedIn.length}</h3><ul>${triples(usedIn)}</ul>`;
}

// WALK — a table built by walking out from an anchor.
//
// Two trees, per the README. The COLUMN TREE is what you tick: rooted at an
// anchor function, branching, made of function names only. The VALUE TREE is
// what each starting value finds walking it, and its leaves are the rows. The
// tree you tick is a schema written at view time — it lives here and never in
// the graph, which is why a snapshot is untouched by it.
//
// It reads the ATOMS, not the picture, so it works with the graph tab closed.

let wTree: WALK.Column | null = null;
let wPick: { header: string; value: string } | null = null;
let wQual = true;

function renderWalk(): string {
  if (!wTree) {
    const fns = WALK.anchorFunctions(wIndex);
    if (!fns.length) return `<div class="hint">no calls here yet.</div>`;
    return `<div class="hint">Pick a function. Everything it produced becomes ` +
           `the rows, and you tick your way outward from there.</div>` +
           `<div class="row">` + fns.map(f =>
             `<button class="morebtn" data-anchor="${esc(f)}">${esc(f)}()</button>`
           ).join(" ") + `</div>`;
  }

  const t = WALK.tabulate(wIndex, wTree, { maxRows: 2000 });
  const tree = wTree;
  let h = `<div class="head"><b>${esc(tree.header)}</b>` +
    ` <button class="morebtn" data-walk-reset="1">change anchor</button>` +
    ` <button class="morebtn" data-walk-qual="1">qualifiers: ${wQual ? "on" : "off"}</button></div>`;
  h += `<h3>${t.rows.length} row(s), ${t.columns.length} column(s)` +
       (t.capped ? ` — <b>capped at 2000</b>, untick a column` : ``) +
       ` · click a cell to see where it can go</h3>`;

  h += `<div class="tablewrap"><table><thead><tr>` + t.columns.map(c =>
    `<th>${esc(c)}` + (c === tree.header ? `` :
      ` <span style="cursor:pointer;color:#888" data-walk-drop="${esc(c)}">&times;</span>`) +
    `</th>`).join("") + `</tr></thead><tbody>`;

  for (const r of t.rows) {
    h += `<tr>` + t.columns.map(c => {
      const cell = r[c];
      // "?" is a step that found nothing. The row survives.
      if (!cell) return `<td>?</td>`;
      const shown = wQual ? WALK.qualified(cell) : cell.value;
      const hot = wPick && wPick.header === c && wPick.value === cell.value;
      return `<td style="cursor:pointer${hot ? ";color:#fff;background:#333" : ""}" ` +
             `data-walk-cell="${esc(c)}" data-walk-val="${esc(cell.value)}">${esc(shown)}</td>`;
    }).join("") + `</tr>`;
  }
  h += `</tbody></table></div>`;

  if (wPick) {
    // offered from calls that exist, so a step that finds nothing is never on
    // the menu.
    const pick = wPick;
    const steps = WALK.stepsFrom(wIndex, pick.value);
    h += `<div class="head">from ${esc(pick.value)}</div>`;
    h += steps.length
      ? `<div class="row">` + steps.map(st =>
          `<button class="morebtn" data-walk-add="${esc(WALK.stepName(st))}"` +
          ` data-walk-parent="${esc(pick.header)}">${esc(WALK.stepName(st))}</button>`
        ).join(" ") + `</div>`
      : `<div class="hint">nothing goes anywhere from here.</div>`;
  }
  return h;
}

let view: View = "walk";

function renderRight(): void {
  if (view === "graph") return;   // the picture draws itself
  viewEl.innerHTML = view === "walk" ? renderWalk() : renderTriples(selected());
}

// ---------------------------------------------------------------------------
// events

const near = (e: Event, sel: string): HTMLElement | null =>
  e.target instanceof Element ? e.target.closest<HTMLElement>(sel) : null;
const attr = (node: HTMLElement, key: string): string => node.dataset[key] ?? "";

viewEl.addEventListener("click", e => {
  // walk tab. Ticking a step edits the column tree and nothing else; the graph
  // is never touched by any of this.
  const wAnchor = near(e, "[data-anchor]");
  if (wAnchor) { wTree = WALK.newTree(attr(wAnchor, "anchor")); wPick = null; renderRight(); return; }
  if (near(e, "[data-walk-reset]")) { wTree = null; wPick = null; renderRight(); return; }
  if (near(e, "[data-walk-qual]")) { wQual = !wQual; renderRight(); return; }
  const wDrop = near(e, "[data-walk-drop]");
  if (wDrop && wTree) { WALK.removeNode(wTree, attr(wDrop, "walkDrop")); wPick = null; renderRight(); return; }
  const wAdd = near(e, "[data-walk-add]");
  if (wAdd && wTree) {
    const nm = attr(wAdd, "walkAdd");
    const dir = nm.startsWith("rev_") ? "rev" : "fwd";
    const fn = nm.replace(/^rev_/, "").replace(/\(\)$/, "");
    WALK.addStep(wTree, attr(wAdd, "walkParent"), { dir, fn });
    wPick = null; renderRight(); return;
  }
  const wCell = near(e, "[data-walk-cell]");
  if (wCell) {
    const header = attr(wCell, "walkCell"), value = attr(wCell, "walkVal");
    const same = wPick !== null && wPick.header === header && wPick.value === value;
    wPick = same ? null : { header, value };
    renderRight(); return;
  }

  const chipEl = near(e, "[data-id]");
  if (chipEl) selectNode(attr(chipEl, "id"));
});

// tab switching. The graph is built the first time it is asked for and never
// before — laying out a thousand nodes is not something to do behind somebody's
// back while they are reading a table.
el("tabs").addEventListener("click", e => {
  const tab = near(e, ".tab");
  if (!tab) return;
  view = attr(tab, "view") as View;
  document.querySelectorAll("#tabs .tab").forEach(t => t.classList.toggle("on", t === tab));

  const graph = view === "graph";
  el("net").style.display = graph ? "" : "none";
  el("netbar").style.display = graph ? "" : "none";
  viewEl.style.display = graph ? "none" : "";
  if (graph) { build(); network.redraw(); network.fit(); }
  renderRight();
});

el("multi").addEventListener("click", () => {
  multi = !multi;
  el("multi").classList.toggle("on", multi);
  el("multi").textContent = "multi-select: " + (multi ? "on" : "off");
  if (!multi && seeds.size > 1) clearSelection();
});

// ---- sources ----

function status(): void {
  el("srcstat").textContent =
    `${serverAtoms.length} from the pile · ${pastedAtoms.length} pasted · ` +
    `${atoms().length} in play`;
}

for (const input of document.querySelectorAll<HTMLInputElement>('input[name="src"]')) {
  input.checked = input.value === source;
  input.addEventListener("change", () => {
    if (!input.checked) return;
    source = input.value as Source;
    remember(source);
    derive();
    if (network) paint(true);
  });
}

el("load").addEventListener("click", () => {
  const text = (el("paste") as HTMLTextAreaElement).value;
  const out: EXPAND.Atom[] = [];
  const bad: number[] = [];
  text.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    try {
      const a: unknown = JSON.parse(t);
      if (Array.isArray(a) && a.length >= 3 && a.every(s => typeof s === "string")) out.push(a as EXPAND.Atom);
      else bad.push(i + 1);
    } catch { bad.push(i + 1); }
  });
  pastedAtoms = out;
  el("pastestat").textContent =
    `${out.length} atom(s)` + (bad.length ? ` · ${bad.length} line(s) ignored (first: ${bad[0]})` : "");
  // Pasting is only useful if you can see it, so switch to it rather than
  // leaving the atoms loaded and invisible.
  if (source === "server" && out.length) {
    source = "both";
    remember(source);
    for (const i of document.querySelectorAll<HTMLInputElement>('input[name="src"]')) i.checked = i.value === source;
  }
  derive();
});

el("clearpaste").addEventListener("click", () => {
  (el("paste") as HTMLTextAreaElement).value = "";
  pastedAtoms = [];
  el("pastestat").textContent = "";
  derive();
});

// ---- the pile ----
//
// Atoms are collected whichever source is selected, so switching to the pile is
// instant and does not need a reconnection. Only what is in play is expanded.

let pending: EXPAND.Atom[] = [], scheduled = false;

function queue(atom: EXPAND.Atom): void {
  pending.push(atom);
  if (scheduled) return;
  scheduled = true;
  // Coalesced into one batch per frame, so a pile replaying hundreds of atoms on
  // connect costs one redraw rather than hundreds.
  setTimeout(() => {
    const batch = pending; pending = []; scheduled = false;
    for (const a of batch) serverAtoms.push(a);
    if (source !== "pasted") { derive(); paint(false); } else status();
  }, 16);
}

const stream = new EventSource("/atoms");
stream.onmessage = e => queue(JSON.parse(e.data as string) as EXPAND.Atom);
stream.addEventListener("reset", () => location.reload());
stream.onerror = () => { if (!serverAtoms.length) status(); };

derive();
