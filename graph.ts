// graph.ts — the NAVIGATION layer over kernel.ts.
//
// The kernel (kernel.ts) is the whole engine: node + apply + edges + dedup + the
// two guards. This file adds only comfort that peels off cleanly — Tree
// navigation plus the console display that makes it readable (log/toString/
// inspect) — and re-exports the same public API (Graph, Node, Tree, NOTHING) so
// nothing downstream changes.
//
// It answers ONE question: how do I move around what is stored? Rendering the
// graph as an external picture is a different question, and lives in view.ts.
//
// Delete anything in this file and the stored graph is byte-identical; the
// kernel still builds it. That's the litmus, and it's why this is a layer.

import { Node as KNode, Graph as KGraph, NOTHING, type Fn } from "./kernel.ts";

type Item = Node | Tree;

// Node = kernel Node + navigation + display. (from()/to() wrap the kernel's raw
// edge reads into structure-preserving Trees.)
class Node extends KNode {
  from(): Tree { return new Tree(this.inNodes() as Node[]); }
  to(): Tree { return new Tree(this.outNodes() as Node[]); }
  apply(fn: string, ...rest: string[]): Node { return super.apply(fn, ...rest) as Node; } // retype

  log(label?: string): this {
    if (label === undefined) console.log(this.value);
    else console.log(label, this.value);
    return this;
  }
  toString(): string { return this.value; }
  [Symbol.for("nodejs.util.inspect.custom")](): string { return this.value; }
}

// A structure-preserving collection: items are Nodes or nested Trees. from()/to()
// map over the items, so each hop nests one level deeper (grouping is kept).
class Tree {
  constructor(readonly items: Item[]) {}

  from(): Tree { return new Tree(this.items.map(it => it.from())); }
  to(): Tree { return new Tree(this.items.map(it => it.to())); }
  apply(fn: string, ...rest: string[]): Tree {
    return new Tree(this.items.map(it => it.apply(fn, ...rest)));
  }
  flatten(): Tree { return new Tree(this.leaves()); }

  // Top-level Nodes only; nested Trees are dropped. (Contrast `values`, which
  // flattens to leaves first.) One hop from one Node yields a flat Tree.
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

// Graph = kernel Graph, but it mints enriched Nodes. (node/apply are retype-only:
// they exist so callers see the enriched Node, not the kernel one.)
class Graph extends KGraph {
  protected makeNode(value: string): Node { return new Node(value, this); }
  node(value: string): Node { return super.node(value) as Node; }
  apply(fn: string, ...args: string[]): Node { return super.apply(fn, ...args) as Node; }

  // Everything a function ever produced: walk fn() -> its applications -> their
  // outputs. (The "fn()" spelling is the kernel's function-as-value node.)
  outputsOf(fn: string): string[] { return this.node(fn + "()").to().to().flatten().values; }
}

export { Graph, Node, Tree, NOTHING };
export type { Fn };
