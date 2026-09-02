export const NOTHING = "∅";
export type Fn = (...args: string[]) => string | null;

export class Node {
  readonly value: string;
  protected graph: Graph;
  protected in: Node[] = [];
  protected out: Node[] = [];
  private role?: "value" | "application";

  constructor(value: string, graph: Graph) { this.value = value; this.graph = graph; }

  setRole(r: "value" | "application"): void {
    if (this.role !== undefined && this.role !== r)
      throw new Error(`role violation: ${JSON.stringify(this.value)} is already a ${this.role}, not also ${r}`);
    this.role = r;
  }
  get roleName(): "value" | "application" { return this.role ?? "value"; }

  linkTo(target: Node): void {
    if (this.role !== undefined && this.role === target.role)
      throw new Error(
        `bipartite violation: ${this.role} → ${target.role} edge ` +
        `${JSON.stringify(this.value)} → ${JSON.stringify(target.value)}`);
    if (!this.out.includes(target)) this.out.push(target);
    if (!target.in.includes(this)) target.in.push(this);
  }

  apply(fn: string, ...rest: string[]): Node {
    if (this.value === NOTHING) return this.graph.node(NOTHING);
    const args = [this.value, ...rest];
    const key = `${fn}(${args.join(",")})`;

    const memo = this.graph.find(key);
    if (memo && memo.out.length > 0) return memo.out[0];

    const raw = this.graph.run(fn, args);
    if (raw === null) return this.graph.node(NOTHING);

    const application = this.graph.node(key); application.setRole("application");
    const result = this.graph.node(raw); result.setRole("value");
    const fnNode = this.graph.node(`${fn}()`); fnNode.setRole("value"); fnNode.linkTo(application);
    for (const arg of args) { const a = this.graph.node(arg); a.setRole("value"); a.linkTo(application); }
    application.linkTo(result);
    return result;
  }

  inNodes(): Node[] { return [...this.in]; }
  outNodes(): Node[] { return [...this.out]; }
}

export class Graph {
  protected nodes = new Map<string, Node>();
  private fns = new Map<string, Fn>();

  protected makeNode(value: string): Node { return new Node(value, this); }

  def(name: string, impl: Fn): void { this.fns.set(name, impl); }

  node(value: string): Node {
    const existing = this.nodes.get(value);
    if (existing) return existing;
    const created = this.makeNode(value);
    this.nodes.set(value, created);
    return created;
  }
  find(value: string): Node | undefined { return this.nodes.get(value); }

  apply(fn: string, ...args: string[]): Node {
    return this.node(args[0]).apply(fn, ...args.slice(1));
  }
  run(fn: string, args: string[]): string | null {
    const impl = this.fns.get(fn);
    if (!impl) throw new Error(`no function named "${fn}"`);
    return impl(...args);
  }
  all(): Node[] { return [...this.nodes.values()]; }
}
