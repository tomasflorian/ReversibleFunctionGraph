// graph.ts — Reversible Function Graph 2 (minimal).
//
// Everything is a node: values, functions, and function applications. One Node
// class; "Value" and "Application" are roles you read from a node's string and
// edges, not types. Edges are unlabeled and directional, recorded once and
// walkable both ways. One node per distinct string (dedup); nothing is lost.
//
// Navigation PRESERVES STRUCTURE: from()/to() return a Tree that nests one level
// deeper per hop, so grouping is never lost. flatten() collapses it to one bag
// when you actually want that.
//
// FAILURE / NOTHING: a function impl returns a string to RECORD a result, or JS
// `null` to say "this happened but leave no trace" (the silent-filter case). On
// null, apply records nothing and yields the one reserved NOTHING node. Applying
// anything to NOTHING short-circuits back to NOTHING — so a broken step just
// carries through a chain without every function having to guard for it. The
// skip lives in apply, not in the functions (this is the Maybe/Option pattern).
//
// NOTHING is one reserved node with a distinctive string identity. It is the
// only in-band sentinel; centralize every check through the NOTHING constant so
// the representation can be swapped for an out-of-band identity later.

const NOTHING = "∅"; // the single reserved "no value" node

// A function returns a string (record it) or null (don't record — yield NOTHING).
type Fn = (...args: string[]) => string | null;
type Item = Node | Tree;

class Node {
  readonly value: string;
  private graph: Graph;
  private in: Node[] = [];  // nodes pointing INTO this one  (producers / inputs)
  private out: Node[] = []; // nodes this points TO          (outputs / consumers)

  constructor(value: string, graph: Graph) {
    this.value = value;
    this.graph = graph;
  }

  // ---- STRUCTURE — builds or reads the graph ----

  // Connect  this ──▶ target  (unlabeled, both ends remember it).
  linkTo(target: Node): void {
    if (!this.out.includes(target)) this.out.push(target);
    if (!target.in.includes(this)) target.in.push(this);
  }

  // Forward: compute fn(this, ...rest), build its Application subgraph, return the result.
  apply(fn: string, ...rest: string[]): Node {
    // NOTHING short-circuits: applying anything to it yields NOTHING, unrecorded.
    // The skip lives here, so functions never see NOTHING and never run on it.
    if (this.value === NOTHING) return this.graph.node(NOTHING);

    const args = [this.value, ...rest];
    const key = `${fn}(${args.join(",")})`;

    const memo = this.graph.find(key);                         // don't create on a miss
    if (memo && memo.out.length > 0) return memo.out[0];       // already computed

    const raw = this.graph.run(fn, args);                      // string | null
    if (raw === null) return this.graph.node(NOTHING);         // "don't record" — yield NOTHING

    const application = this.graph.node(key);                  // create ONLY when recording
    const result = this.graph.node(raw);
    this.graph.node(`${fn}()`).linkTo(application);            // function ──▶ application
    for (const arg of args) this.graph.node(arg).linkTo(application); // args ──▶ application
    application.linkTo(result);                                // application ──▶ result
    return result;
  }

  // Navigation: a node's direct inputs / outputs, as a one-level Tree.
  from(): Tree { return new Tree([...this.in]); }
  to(): Tree { return new Tree([...this.out]); }

  // Outgoing edges of this node — for inspection / visualization.
  links(): Node[] { return [...this.out]; }

  // ---- ERGONOMICS — display only ----

  log(label?: string): this {
    if (label === undefined) console.log(this.value);
    else console.log(label, this.value);
    return this;
  }

  toString(): string {
    return this.value;
  }
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.value;
  }
}

// A structure-preserving collection: items are Nodes or nested Trees. from()/to()
// map over the items, so each hop nests one level deeper (grouping is kept).
class Tree {
  // ---- STRUCTURE — batched over the members, structure preserved ----
  constructor(readonly items: Item[]) {}

  from(): Tree { return new Tree(this.items.map(it => it.from())); }
  to(): Tree { return new Tree(this.items.map(it => it.to())); }
  apply(fn: string, ...rest: string[]): Tree {
    return new Tree(this.items.map(it => it.apply(fn, ...rest)));
  }

  // Collapse the tree to a flat Tree of leaf nodes (the opt-in "one bag").
  flatten(): Tree {
    return new Tree(this.leaves());
  }

  // ---- ERGONOMICS — display only ----

  get values(): string[] {
    return this.leaves().map(n => n.value);
  }
  log(label?: string): this {
    if (label === undefined) console.log(this.toString());
    else console.log(label, this.toString());
    return this;
  }
  toString(): string {
    return `[${this.items.map(it => it.toString()).join(", ")}]`;
  }
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }

  private leaves(): Node[] {
    const out: Node[] = [];
    const walk = (it: Item): void => {
      if (it instanceof Tree) it.items.forEach(walk);
      else out.push(it);
    };
    this.items.forEach(walk);
    return out;
  }
}

class Graph {
  // ---- STRUCTURE — the graph itself ----
  private nodes = new Map<string, Node>(); // value -> the one node (deduplicated)
  private fns = new Map<string, Fn>();     // fn name -> implementation

  // Register a function.
  def(name: string, impl: Fn): void {
    this.fns.set(name, impl);
  }

  // The single node for a value (created the first time it is seen).
  node(value: string): Node {
    const existing = this.nodes.get(value);
    if (existing) return existing;

    const created = new Node(value, this);
    this.nodes.set(value, created);
    return created;
  }

  // Look up a node WITHOUT creating it (used by apply's memo check, so a
  // non-recorded failure never leaves an orphan application node behind).
  find(value: string): Node | undefined {
    return this.nodes.get(value);
  }

  // Graph-level apply: fn(args…), subject is arg 0 (same UFCS convention as
  // Node.apply). This is what a function BODY calls to use another function —
  // the inner call traces and memoizes like any other, and stays FLAT: it hangs
  // off its own inputs as a sibling, never wired to the outer call.
  apply(fn: string, ...args: string[]): Node {
    return this.node(args[0]).apply(fn, ...args.slice(1));
  }

  // Run a registered function on its arguments. Returns the impl's result:
  // a string (record it) or null (don't record — apply yields NOTHING).
  run(fn: string, args: string[]): string | null {
    const impl = this.fns.get(fn);
    if (!impl) throw new Error(`no function named "${fn}"`);
    return impl(...args);
  }

  // A plain read-only view of the whole graph — for visualization.
  // Edges are unlabeled (direction only); role is read from each node's string.
  snapshot(): { nodes: string[]; edges: { from: string; to: string }[] } {
    const all = [...this.nodes.values()];
    const nodes = all.map(n => n.value);
    const edges = all.flatMap(n =>
      n.links().map(to => ({ from: n.value, to: to.value })),
    );
    return { nodes, edges };
  }
}

export { Graph, Node, Tree, NOTHING };
