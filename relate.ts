// relate.ts — WHAT RELATIONS DOES THIS DATA HAVE? Reading named relations back
// off the graph's edges.
//
// Everything here is SUGAR: it only READS. It produces no nodes at all, so the
// project's litmus applies trivially — delete this file and the stored graph is
// byte-identical. It adds no data model, only nicer ways to read the one you have.
//
// The one trick that kills the gnarliest client code (parsing application-name
// strings like `edit(${x},`): it reads relations from STRUCTURE. An application's
// inputs are recorded as [fn(), arg0, arg1, ...] in that order — that's how
// `apply` builds them — so "which relation" and "which subject" come from the
// edges, never from the fn(args) text. That also can't be fooled by data that
// happens to contain delimiters.

import { Graph, Node } from "./graph.ts";

export function relate(g: Graph) {
  const inputsOf = (app: Node) => app.from().nodes.map(n => n.value); // [fn(), arg0, ...]
  const outputOf = (app: Node) => app.to().nodes[0]?.value ?? null;

  // FOLLOW a named relation forward: from `subject`, the outputs of every
  // `rel(subject, ...)` application (subject is arg0).
  function follow(subject: string, rel: string): string[] {
    const out: string[] = [];
    for (const app of g.node(subject).to().nodes) {
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
    for (const app of g.node(node).from().nodes)
      if (inputsOf(app)[0] === rel + "()") out.push(inputsOf(app)[1]);
    return out;
  }

  return { follow, back };
}
