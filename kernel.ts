// kernel.ts — the irreducible core of the Reversible Function Graph.
//
// This is the whole engine: one node per distinct string (dedup), one operation
// (apply) that computes a function, reifies the call as a node, memoizes it, and
// wires unlabeled value↔application edges. Everything else in the project —
// Tree navigation, the view, relations, shapes, and the whole general/scenario stack
// — is a LAYER built on just this. If the core is right, it never has to change.
//
// The two GUARDS (role + bipartite) live here on purpose: they can't be peeled
// into a layer without weakening them, because `apply` is what assigns the roles
// the guard checks. So the invariants ARE part of the core.
//
// NOTHING: a function impl returns a string (record it) or null (leave no trace).
// On null, apply yields the one reserved NOTHING node; applying anything to
// NOTHING short-circuits back to NOTHING (the skip lives in apply, not in impls).

export const NOTHING = "∅";
export type Fn = (...args: string[]) => string | null;

export class Node {
  readonly value: string;
  protected graph: Graph;
  protected in: Node[] = [];  // nodes pointing INTO this one (producers)
  protected out: Node[] = []; // nodes this points TO         (consumers)
  private role?: "value" | "application";

  constructor(value: string, graph: Graph) { this.value = value; this.graph = graph; }

  // GUARD #1 — a node is a value OR an application, never both.
  setRole(r: "value" | "application"): void {
    if (this.role !== undefined && this.role !== r)
      throw new Error(`role violation: ${JSON.stringify(this.value)} is already a ${this.role}, not also ${r}`);
    this.role = r;
  }
  get roleName(): "value" | "application" { return this.role ?? "value"; }

  // Connect this ──▶ target. GUARD #2 — every edge crosses value ↔ application.
  linkTo(target: Node): void {
    if (this.role !== undefined && this.role === target.role)
      throw new Error(
        `bipartite violation: ${this.role} → ${target.role} edge ` +
        `${JSON.stringify(this.value)} → ${JSON.stringify(target.value)}`);
    if (!this.out.includes(target)) this.out.push(target);
    if (!target.in.includes(this)) target.in.push(this);
  }

  // THE operation: compute fn(this, ...rest), reify + memoize the call, wire edges.
  apply(fn: string, ...rest: string[]): Node {
    if (this.value === NOTHING) return this.graph.node(NOTHING);      // skip: NOTHING absorbs
    const args = [this.value, ...rest];
    const key = `${fn}(${args.join(",")})`;

    const memo = this.graph.find(key);
    if (memo && memo.out.length > 0) return memo.out[0];             // already computed

    const raw = this.graph.run(fn, args);
    if (raw === null) return this.graph.node(NOTHING);               // null: leave no trace

    const application = this.graph.node(key); application.setRole("application");
    const result = this.graph.node(raw); result.setRole("value");
    const fnNode = this.graph.node(`${fn}()`); fnNode.setRole("value"); fnNode.linkTo(application);
    for (const arg of args) { const a = this.graph.node(arg); a.setRole("value"); a.linkTo(application); }
    application.linkTo(result);
    return result;
  }

  // raw edge reads (the layer wraps these into Tree navigation / snapshot)
  inNodes(): Node[] { return [...this.in]; }
  outNodes(): Node[] { return [...this.out]; }
}

export class Graph {
  protected nodes = new Map<string, Node>();
  private fns = new Map<string, Fn>();

  // factory hook: a layer overrides this to create an enriched Node.
  protected makeNode(value: string): Node { return new Node(value, this); }

  def(name: string, impl: Fn): void { this.fns.set(name, impl); }

  node(value: string): Node {                                       // dedup: one node per string
    const existing = this.nodes.get(value);
    if (existing) return existing;
    const created = this.makeNode(value);
    this.nodes.set(value, created);
    return created;
  }
  find(value: string): Node | undefined { return this.nodes.get(value); } // no create (memo check)

  apply(fn: string, ...args: string[]): Node {                      // UFCS: subject is arg 0
    return this.node(args[0]).apply(fn, ...args.slice(1));
  }
  run(fn: string, args: string[]): string | null {
    const impl = this.fns.get(fn);
    if (!impl) throw new Error(`no function named "${fn}"`);
    return impl(...args);
  }
  all(): Node[] { return [...this.nodes.values()]; }                // every node; view.ts snapshot reads this
}
