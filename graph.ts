// graph.ts — the ergonomic LAYER over kernel.ts.
//
// The kernel (kernel.ts) is the whole engine: node + apply + edges + dedup + the
// two guards. This file adds only comfort that peels off cleanly — Tree
// navigation, display (log/toString/inspect), and snapshot — and re-exports the
// same public API (Graph, Node, Tree, NOTHING) so nothing downstream changes.
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
  links(): Node[] { return this.outNodes() as Node[]; } // outgoing edges, for snapshot
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

// Graph = kernel Graph, but it mints enriched Nodes and can snapshot itself.
class Graph extends KGraph {
  protected makeNode(value: string): Node { return new Node(value, this); }
  node(value: string): Node { return super.node(value) as Node; }
  apply(fn: string, ...args: string[]): Node { return super.apply(fn, ...args) as Node; }

  // A plain read-only view of the whole graph — for visualization.
  snapshot(): {
    nodes: { value: string; role: "value" | "application" }[];
    edges: { from: string; to: string }[];
  } {
    const all = this.all() as Node[];
    const nodes = all.map(n => ({ value: n.value, role: n.roleName }));
    const edges = all.flatMap(n => n.links().map(to => ({ from: n.value, to: to.value })));
    return { nodes, edges };
  }
}

export { Graph, Node, Tree, NOTHING };
export type { Fn };
