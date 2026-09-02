// shapes.ts — WHAT SHAPE IS THIS DATA? Declaring that a string is a record with
// fields, or that one string supersedes another.
//
// The difference from relate.ts: those only READ. These WRITE — each one calls
// g.def to teach the graph functions. Saying "this is a pipe-separated record
// with these four fields" is a claim about what the data MEANS, not a traversal.
//
// Still sugar, same litmus: record() builds exactly the graph you'd get writing
// the field-chopping loop by hand, and versioned() is one g.def plus edge walks
// borrowed from relate.ts.

import { Graph } from "./graph.ts";
import { relate } from "./relate.ts";

export function shapes(g: Graph) {
  const { follow, back } = relate(g);

  // A RECORD shape: teach the graph one field-function per field, and hand back
  // make / chop / read / put. Optional guard makes fields null (→ silent) when
  // the input isn't a valid record of this shape.
  function record(sep: string, fields: string[], guard?: (r: string) => boolean) {
    fields.forEach((f, i) =>
      g.def(f, r => (!guard || guard(r)) ? (r.split(sep)[i] ?? null) : null));
    const make = (...vals: string[]) => vals.join(sep);         // build the record string
    const chop = (rec: string) => { for (const f of fields) g.node(rec).apply(f); return rec; };
    const read = (rec: string, f: string) => g.node(rec).apply(f).value;
    const put  = (...vals: string[]) => chop(make(...vals));    // make + store, returns the record
    return { make, chop, read, put, fields };
  }

  // A VERSIONING relation `rel(old,new) -> new`: correction chains, resolved by
  // walking edges. next/prev step one hop; tip/root go to the ends; chain lists
  // the whole line oldest→tip; apply(old,new) draws one edit edge.
  function versioned(rel: string) {
    g.def(rel, (_old, neu) => neu);
    const next = (rec: string) => follow(rec, rel)[0] ?? null;
    const prev = (rec: string) => back(rec, rel)[0] ?? null;
    const tip  = (rec: string) => { let c = rec, n: string | null; while ((n = next(c))) c = n; return c; };
    const root = (rec: string) => { let c = rec, p: string | null; while ((p = prev(c))) c = p; return c; };
    const chain = (rec: string) => {
      const t = tip(rec), out = [t];
      for (let p = prev(t); p; p = prev(p)) out.unshift(p);
      return out;
    };
    const apply = (oldRec: string, newRec: string) => { g.node(oldRec).apply(rel, newRec); return newRec; };
    return { next, prev, tip, root, chain, apply };
  }

  return { record, versioned };
}
