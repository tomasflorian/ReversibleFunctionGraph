import { Graph } from "./graph.ts";
import { relate } from "./relate.ts";

const LIST = "|";

export function shapes(g: Graph) {
  const { follow, back } = relate(g);

  function record(sep: string, fields: string[], guard?: (r: string) => boolean) {
    fields.forEach((f, i) =>
      g.def(f, r => (!guard || guard(r)) ? (r.split(sep)[i] ?? null) : null));
    const make = (...vals: string[]) => vals.join(sep);
    const of   = (rec: string) => fields.map(f => g.node(rec).apply(f));
    const read = (rec: string, f: string) => g.node(rec).apply(f).value;
    const put  = (...vals: string[]) => { const rec = make(...vals); of(rec); return rec; };
    return { make, of, read, put, fields };
  }

  function sequence(cut: string, elem: string, split: (s: string) => string[]) {
    g.def(cut, s => split(s).join(LIST));
    g.def(elem, (l, part) => l.split(LIST).includes(part) ? part : null);
    const list = (s: string) => g.node(s).apply(cut);
    const of = (s: string) => {
      const l = list(s);
      return l.value.split(LIST).map(p => l.apply(elem, p));
    };
    return { list, of };
  }

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

  return { record, sequence, versioned };
}
