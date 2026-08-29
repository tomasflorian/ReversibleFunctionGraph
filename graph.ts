// graph.ts — Reversible Function Graph 2 (minimal).
//
// Everything is a node: values, functions, and function applications. One Node
// class; "Value" and "Application" are roles you read from a node's string and
// edges, not types. Edges are unlabeled and directional, recorded once and
// walkable both ways. One node per distinct string (dedup); nothing is lost.
//
// apply("fn", ...rest) computes fn(this, ...rest) and builds the little subgraph
//   function ─┐
//   arg0 ─────┼─▶ Application ─▶ result
//   arg1 ─────┘
// then returns the result node.

type Fn = (...args: string[]) => string;

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
    const args = [this.value, ...rest];
    const application = this.graph.node(`${fn}(${args.join(",")})`);
    if (application.out.length > 0) return application.out[0]; // already computed

    const result = this.graph.node(this.graph.run(fn, args));
    this.graph.node(`${fn}()`).linkTo(application);            // function ──▶ application
    for (const arg of args) this.graph.node(arg).linkTo(application); // args ──▶ application
    application.linkTo(result);                                // application ──▶ result
    return result;
  }

  // Reverse / forward navigation over the unlabeled edges.
  from(): NodeList { return new NodeList([...this.in]); }
  to(): NodeList { return new NodeList([...this.out]); }

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

class NodeList {
  // ---- STRUCTURE — batched over the members ----
  constructor(readonly nodes: Node[]) {}

  apply(fn: string, ...rest: string[]): NodeList {
    return new NodeList(this.nodes.map(n => n.apply(fn, ...rest)));
  }
  from(): NodeList { return new NodeList(this.nodes.flatMap(n => n.from().nodes)); }
  to(): NodeList { return new NodeList(this.nodes.flatMap(n => n.to().nodes)); }

  // ---- ERGONOMICS — display only ----

  get values(): string[] {
    return this.nodes.map(n => n.value);
  }
  log(label?: string): this {
    if (label === undefined) console.log(this.toString());
    else console.log(label, this.toString());
    return this;
  }
  toString(): string {
    return `[${this.values.join(", ")}]`;
  }
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
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

  // Run a registered function on its arguments.
  run(fn: string, args: string[]): string {
    const impl = this.fns.get(fn);
    if (!impl) throw new Error(`no function named "${fn}"`);
    return impl(...args);
  }
}

export { Graph, Node, NodeList };
