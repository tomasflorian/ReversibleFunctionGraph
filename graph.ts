import { Node as KNode, Graph as KGraph, NOTHING, type Fn } from "./kernel.ts";

type Item = Node | Tree;

class Node extends KNode {
  from(): Tree { return new Tree(this.inNodes() as Node[]); }
  to(): Tree { return new Tree(this.outNodes() as Node[]); }
  apply(fn: string, ...rest: string[]): Node { return super.apply(fn, ...rest) as Node; }

  log(label?: string): this {
    if (label === undefined) console.log(this.value);
    else console.log(label, this.value);
    return this;
  }
  toString(): string { return this.value; }
  [Symbol.for("nodejs.util.inspect.custom")](): string { return this.value; }
}

class Tree {
  constructor(readonly items: Item[]) {}

  from(): Tree { return new Tree(this.items.map(it => it.from())); }
  to(): Tree { return new Tree(this.items.map(it => it.to())); }
  apply(fn: string, ...rest: string[]): Tree {
    return new Tree(this.items.map(it => it.apply(fn, ...rest)));
  }
  flatten(): Tree { return new Tree(this.leaves()); }

  get nodes(): Node[] { return this.items.filter((it): it is Node => it instanceof Node); }
  get values(): string[] { return this.leaves().map(n => n.value); }
  log(label?: string): this {
    if (label === undefined) console.log(this.toString());
    else console.log(label, this.toString());
    return this;
  }
  toString(): string { return `[${this.items.map(it => it.toString()).join(", ")}]`; }
  [Symbol.for("nodejs.util.inspect.custom")](): string { return this.toString(); }

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

class Graph extends KGraph {
  protected makeNode(value: string): Node { return new Node(value, this); }
  node(value: string): Node { return super.node(value) as Node; }
  apply(fn: string, ...args: string[]): Node { return super.apply(fn, ...args) as Node; }

  outputsOf(fn: string): string[] { return this.node(fn + "()").to().to().flatten().values; }
}

export { Graph, Node, Tree, NOTHING };
export type { Fn };
