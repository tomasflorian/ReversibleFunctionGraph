// walk.js — the machinery behind the `walk` tab: build a table by walking the
// graph outward from a set of starting values.
//
// Two trees, per new-tab-spec.md:
//
//   the COLUMN TREE   what you ticked. Rooted at an anchor function, branching.
//                     Function names only, no data, the same for every row.
//   the VALUE TREE    what one starting value finds walking it. Branches wherever
//                     a step finds more than one answer. Rows are its leaves.
//
// Plain JS on purpose: graph.html loads this with a <script> tag and node
// require()s it, and neither can take a .ts without a build step this project
// does not have. Same file, both callers — see spec section 7.
//
// Input is {nodes, edges} — exactly what window.GRAPH holds and what every file
// in snapshots/ is. Never a Graph object, so the CLI and the browser agree.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WALK = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- index -------------------------------------------------------------
  //
  // A call is stored as an application node whose VALUE is the call itself:
  //   "emp(bob|2026-08-25|projX|8|1)"  or  "word(the|city|is|old,city)"
  // Its arguments and its function node point AT it; it points at its result.
  // Edges carry no order, so the subject (the first argument) is recovered by
  // matching the inbound values against the call's own text. Longest match wins,
  // because one argument can be a prefix of another.

  function buildIndex(graph) {
    const role = new Map();
    for (const n of graph.nodes) role.set(n.id, n.role);

    const inbound = new Map();   // app -> [value ids]
    const outbound = new Map();  // app -> [value ids]
    for (const e of graph.edges) {
      if (role.get(e.to) === "application") {
        if (!inbound.has(e.to)) inbound.set(e.to, []);
        inbound.get(e.to).push(e.from);
      }
      if (role.get(e.from) === "application") {
        if (!outbound.has(e.from)) outbound.set(e.from, []);
        outbound.get(e.from).push(e.to);
      }
    }

    const apps = new Map();          // appId -> {fn, subject, extras, result}
    const bySubject = new Map();     // value -> [appId]
    const byResult = new Map();      // value -> [appId]

    for (const n of graph.nodes) {
      if (n.role !== "application") continue;
      const open = n.id.indexOf("(");
      if (open < 0) continue;
      const fn = n.id.slice(0, open);
      const argText = n.id.slice(open + 1, n.id.lastIndexOf(")"));

      const ins = (inbound.get(n.id) || []).filter(v => v !== fn + "()");
      const result = (outbound.get(n.id) || [])[0];
      if (result === undefined) continue;

      // subject = the argument the call's text starts with (longest first)
      let subject = null;
      for (const v of ins.slice().sort((a, b) => b.length - a.length)) {
        if (argText === v || argText.indexOf(v + ",") === 0) { subject = v; break; }
      }
      if (subject === null) continue;

      const extras = ins.filter(v => v !== subject);
      apps.set(n.id, { fn: fn, subject: subject, extras: extras, result: result });

      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(n.id);
      if (!byResult.has(result)) byResult.set(result, []);
      byResult.get(result).push(n.id);
    }

    return { role: role, apps: apps, bySubject: bySubject, byResult: byResult };
  }

  // --- steps -------------------------------------------------------------
  //
  // fn()      go to what the call produced
  // rev_fn()  go to what it CONSUMED — the subject only. Extra arguments are
  //           part of the call's identity, not a place you can walk to, or
  //           rev_word() from "city" would hand back "city" itself, since
  //           sequence writes its selector as (list, part) => part.

  function stepFwd(index, value, fn) {
    const out = [];
    for (const id of index.bySubject.get(value) || []) {
      const a = index.apps.get(id);
      if (a.fn === fn && out.indexOf(a.result) < 0) out.push(a.result);
    }
    return out;
  }

  function stepRev(index, value, fn) {
    const out = [];
    for (const id of index.byResult.get(value) || []) {
      const a = index.apps.get(id);
      if (a.fn === fn && out.indexOf(a.subject) < 0) out.push(a.subject);
    }
    return out;
  }

  function step(index, value, dir, fn) {
    return dir === "rev" ? stepRev(index, value, fn) : stepFwd(index, value, fn);
  }

  // Every step available from a value, one hop out. This is what a cell offers
  // when you click it: computed from calls that exist, so a step that finds
  // nothing is never on the menu.
  function stepsFrom(index, value) {
    const seen = {}, out = [];
    for (const id of index.bySubject.get(value) || []) {
      const fn = index.apps.get(id).fn, key = "fwd " + fn;
      if (!seen[key]) { seen[key] = 1; out.push({ dir: "fwd", fn: fn }); }
    }
    for (const id of index.byResult.get(value) || []) {
      const fn = index.apps.get(id).fn, key = "rev " + fn;
      if (!seen[key]) { seen[key] = 1; out.push({ dir: "rev", fn: fn }); }
    }
    out.sort((a, b) => a.fn.localeCompare(b.fn) || a.dir.localeCompare(b.dir));
    return out;
  }

  // every function that produced something — the anchors you can start from
  function anchorFunctions(index) {
    const seen = {};
    index.apps.forEach(a => { seen[a.fn] = 1; });
    return Object.keys(seen).sort();
  }

  function anchorValues(index, fn) {
    const out = [];
    index.apps.forEach(a => {
      if (a.fn === fn && out.indexOf(a.result) < 0) out.push(a.result);
    });
    return out.sort();
  }

  // --- the column tree ---------------------------------------------------

  function stepName(s) { return (s.dir === "rev" ? "rev_" : "") + s.fn + "()"; }

  function newTree(anchorFn) {
    return { step: null, anchorFn: anchorFn, header: anchorFn + "()", children: [] };
  }

  // A header reads destination-first and spells out the way back: a child is its
  // own step in front of its parent's header, so two columns that branch from the
  // same point share a suffix and the header says where they pair. The anchor is
  // left off — it is the same for every column, so naming it says nothing.
  function addStep(tree, parentHeader, s) {
    const parent = findNode(tree, parentHeader);
    if (!parent) return null;
    const h = parent.step === null ? stepName(s) : stepName(s) + " via " + parent.header;
    if (parent.children.some(c => c.header === h)) return null;
    const child = { step: s, header: h, children: [] };
    parent.children.push(child);
    return child;
  }

  function findNode(tree, header) {
    if (tree.header === header) return tree;
    for (const c of tree.children) {
      const found = findNode(c, header);
      if (found) return found;
    }
    return null;
  }

  function removeNode(tree, header) {
    for (let i = 0; i < tree.children.length; i++) {
      if (tree.children[i].header === header) { tree.children.splice(i, 1); return true; }
      if (removeNode(tree.children[i], header)) return true;
    }
    return false;
  }

  function columns(tree) {
    const out = [];
    (function walk(n) { out.push(n.header); n.children.forEach(walk); })(tree);
    return out;
  }

  // --- the value tree ----------------------------------------------------
  //
  // Rows are its leaves. Siblings are computed from the SAME parent value, so
  // two branches pair at their deepest shared step — which is the whole reason
  // the walk carries its intermediate values instead of collapsing each branch
  // to a set of leaves. Collapsing gives a cross product and six wrong rows for
  // bob instead of three right ones. See spec section 3.

  function expand(index, node, value, chain, isRoot, cap, state) {
    const base = {};
    base[node.header] = { value: value, chain: chain };
    let rows = [base];

    const childChain = isRoot ? [] : chain.concat([value]);

    for (const child of node.children) {
      const vals = step(index, value, child.step.dir, child.step.fn);
      const next = [];
      for (const row of rows) {
        if (vals.length === 0) { next.push(row); continue; }  // descendants -> "?"
        for (const cv of vals) {
          const subs = expand(index, child, cv, childChain, false, cap, state);
          for (const sub of subs) {
            if (next.length + state.count >= cap) { state.capped = true; break; }
            const merged = {};
            for (const k in row) merged[k] = row[k];
            for (const k in sub) merged[k] = sub[k];
            next.push(merged);
          }
        }
      }
      rows = next;
    }
    return rows;
  }

  function tabulate(index, tree, opts) {
    opts = opts || {};
    const cap = opts.maxRows || 2000;
    const state = { count: 0, capped: false };
    const rows = [];
    for (const v of anchorValues(index, tree.anchorFn)) {
      if (state.count >= cap) { state.capped = true; break; }
      const got = expand(index, tree, v, [], true, cap, state);
      for (const r of got) rows.push(r);
      state.count = rows.length;
    }
    return { columns: columns(tree), rows: rows, capped: state.capped };
  }

  // --- display -----------------------------------------------------------
  //
  // NEVER shorten a value. No nickname, no ellipsis, no hover-to-see-the-rest —
  // a value's text is its identity, and an abbreviation grows into an invented
  // identifier. Quoting is not shortening: it stops a value containing the
  // display's own separators from being read as one.

  function quote(v) {
    return /[|.,"\s]/.test(v) ? '"' + v.replace(/"/g, '\\"') + '"' : v;
  }

  // "bob|2026-08-25|projX|8|1".2026-08-25 — the walk that produced this cell
  function qualified(cell) {
    if (!cell) return "?";
    const parts = cell.chain.map(quote);
    parts.push(quote(cell.value));
    return parts.join(".");
  }

  return {
    buildIndex: buildIndex,
    stepFwd: stepFwd, stepRev: stepRev, step: step, stepsFrom: stepsFrom,
    anchorFunctions: anchorFunctions, anchorValues: anchorValues,
    newTree: newTree, addStep: addStep, findNode: findNode, removeNode: removeNode,
    columns: columns, tabulate: tabulate,
    stepName: stepName, quote: quote, qualified: qualified
  };
});
