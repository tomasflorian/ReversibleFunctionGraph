import { Producer } from "./producer.js";

// shapes.ts — what a piece of text IS: record field layouts, sequence
// cut-and-extract, edit chains. All three only ever WRITE.
//
// A producer never reads the pile. It knows what it just computed and nothing
// else, so everything here works from a function's own return value — the local
// variable — and never by walking arrows to find out what is already there.
// Reading is a separate job done by whoever is looking: expand.js builds the
// picture, walk.js builds tables, and both start from the atoms.
//
// This is why `versioned` defines an edit and applies it but cannot tell you the
// latest version of a record. "Which one is current" is a question asked over a
// pile, not a fact a writer holds — see walk.js, and the timesheet section of
// combined.ts.

const LIST = "|";

export function shapes(p: Producer) {

  function record(sep: string, fields: string[], guard?: (r: string) => boolean) {
    fields.forEach((f, i) =>
      p.def(f, r => (!guard || guard(r)) ? (r.split(sep)[i] ?? null) : null));
    const make = (...vals: string[]) => vals.join(sep);
    const of   = (rec: string) => fields.map(f => p.value(rec).apply(f));
    const read = (rec: string, f: string) => p.value(rec).apply(f).value;
    const put  = (...vals: string[]) => { const rec = make(...vals); of(rec); return rec; };
    return { make, of, read, put, fields };
  }

  function sequence(cut: string, elem: string, split: (s: string) => string[]) {
    p.def(cut, s => split(s).join(LIST));
    p.def(elem, (l, part) => l.split(LIST).includes(part) ? part : null);
    const list = (s: string) => p.value(s).apply(cut);
    const of = (s: string) => {
      const l = list(s);
      return l.value.split(LIST).map(p => l.apply(elem, p));
    };
    return { list, of };
  }

  // An edit is one call: the old record in, the new record out. Nothing is
  // overwritten and no version is marked current, so the whole chain stays in
  // the pile and "the latest one" is something a reader works out by walking.
  function versioned(rel: string) {
    p.def(rel, (_old, neu) => neu);
    const apply = (oldRec: string, newRec: string) => { p.value(oldRec).apply(rel, newRec); return newRec; };
    return { apply };
  }

  return { record, sequence, versioned };
}
