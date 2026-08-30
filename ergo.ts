// ergo.ts — a thin ERGONOMIC WINDOW over graph.ts.
//
// Everything here is SUGAR: it produces the exact same graph you'd get writing
// g.node(...).apply(...) by hand. The project's litmus applies — delete any of
// it and the stored graph is byte-identical. It adds no data model, only nicer
// ways to read and write the one you have. It's a window, not a wall: anything
// it does, you can still do directly against the raw graph.
//
// The one trick that kills the gnarliest client code (parsing application-name
// strings like `edit(${x},`): it reads relations from STRUCTURE. An application's
// inputs are recorded as [fn(), arg0, arg1, ...] in that order — that's how
// `apply` builds them — so "which relation" and "which subject" come from the
// edges, never from the fn(args) text. That also can't be fooled by data that
// happens to contain delimiters.

import { Graph, Node, Tree } from "./graph.ts";

const nodesOf = (t: Tree): Node[] => t.items.filter(x => x instanceof Node) as Node[];

export function ergo(g: Graph) {
  const inputsOf = (app: Node) => nodesOf(app.from()).map(n => n.value); // [fn(), arg0, ...]
  const outputOf = (app: Node) => nodesOf(app.to())[0]?.value ?? null;

  // FOLLOW a named relation forward: from `subject`, the outputs of every
  // `rel(subject, ...)` application (subject is arg0).
  function follow(subject: string, rel: string): string[] {
    const out: string[] = [];
    for (const app of nodesOf(g.node(subject).to())) {
      const ins = inputsOf(app);
      if (ins[0] === rel + "()" && ins[1] === subject) {
        const o = outputOf(app); if (o !== null) out.push(o);
      }
    }
    return out;
  }
  // BACK along a named relation: the subjects (arg0) of every `rel` application
  // that produced `node`.
  function back(node: string, rel: string): string[] {
    const out: string[] = [];
    for (const app of nodesOf(g.node(node).from()))
      if (inputsOf(app)[0] === rel + "()") out.push(inputsOf(app)[1]);
    return out;
  }

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

  return { follow, back, record, versioned, nodesOf };
}
