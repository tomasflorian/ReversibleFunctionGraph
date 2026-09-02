import { Graph, Node } from "./graph.ts";

export function relate(g: Graph) {
  const inputsOf = (app: Node) => app.from().nodes.map(n => n.value);
  const outputOf = (app: Node) => app.to().nodes[0]?.value ?? null;

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

  function back(node: string, rel: string): string[] {
    const out: string[] = [];
    for (const app of g.node(node).from().nodes)
      if (inputsOf(app)[0] === rel + "()") out.push(inputsOf(app)[1]);
    return out;
  }

  return { follow, back };
}
