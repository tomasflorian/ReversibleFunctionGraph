# Reversible Function Graph 2 — model spec

A rewrite of RFG where **everything is a node**: values, functions, and function
applications. Fully reified, so functions are addressable. Nothing is ever
duplicated, and nothing is lost. Eyeball this as the target before coding.

---

## Two node types

Both are string-nodes (G4). They differ only in the output rule.

- **Value** (multi-output) — a *referenceable thing*: a datum (`"5"`, `"paris"`,
  `"paris|france"`) **or** a function (`"isNumber()"`, `"toLower()"`). Many things
  may point at it and it may feed many things.
  *(prose name: **substance** — it endures and is referenced by many.)*
- **Application** (single-output) — a *computation*: one specific call
  (`"isNumber(5)"`, `"strContains(paris france,france)"`). It resolves to exactly
  one result.
  *(prose name: **act** — a single determinate happening.)*

Code names: `Value` / `Application`. The kind is **readable from structure** (an
Application's string is a call `fn(args)`; a Value's is bare or `fn()`), not a
declared type tag.

## The four guarantees

- **G1 — single output.** An **Application** has exactly **one output** and
  **unlimited inputs**. (Scoped to Application: Values are hubs and may fan out.)
- **G2 — no duplication, no loss.** One node per distinct string. A shared hub
  keeps *all* its edges, so dedup never loses who produced or used it.
- **G3 — direction, not labels.** Edges carry meaning by **direction only** — no
  labels, no metadata. The *order and roles* of a call live in the Application
  node's **string**, not in its edges.
- **G4 — only strings.** The one data type is `string`. A string is a number, a
  list, etc. **only through the function applied to it.**

## What one `apply` builds

Applying function `F` to argument(s) `A…` (each a Value) produces:

1. compute the result string `R = fn(args)`
2. find-or-create the **Application** node whose string is the call `"F(A…)"`
3. wire **unlabeled, directional** edges:
   - each input → Application: `F → App`, and `A → App` for every argument
   - Application → result: `App → R`
4. dedup throughout: same call ⇒ same Application node; same string ⇒ same Value.

So one call adds **1 Application node + (1 + #args) input edges + 1 output edge**,
all deduplicated.

### Example — `isNumber(5)`

```
5 ──────▶ isNumber(5) ──────▶ true
isNumber() ──▶ isNumber(5)
```

- Values (multi-output): `5`, `isNumber()`, `true`
- Application (single-output): `isNumber(5)`  → its one output is `true`
- Inputs of the Application: `5` and `isNumber()` (unordered edges; order/roles
  are read from the string `"isNumber(5)"`).

### Multi-argument — `strContains(paris france, france)`

- One Application node, **three** input edges (`strContains()`, `paris france`,
  `france`), **one** output edge (`true`).
- Argument order is in the node's string, not the edges (G3). `strContains(a,b)`
  and `strContains(b,a)` are different Application nodes with the same edge set —
  the string tells them apart.

## Navigation (reverse is free)

- Every edge is recorded once and indexed from **both ends** → walk either way.
- **Forward:** Application → its result (one edge out).
- **Reverse:** from a Value, walk incoming edges to the Applications that
  **produced** it (a hub → many) and outgoing edges to Applications that **use**
  it as input.
- **Function addressability (the point of the rewrite):** a function Value
  (`toLower()`) has edges to every Application that uses it, so "what has toLower
  been applied to?" and "what functions produced `true`?" are plain walks. A
  root `function` Value ties them together for enumeration.

## Carried over from `graph.ts` (do not reinvent)

- **dedup** (one node per string), **reverse-for-free** (both-ways edges),
  **memoization** (same call ⇒ existing node).
- **Ergonomics layer**: `.log()` / `.values` chaining, custom-inspect (print as
  value), and the one-vs-many handle pair.
- **STRUCTURE / ERGONOMICS banner discipline**; core in `graph.ts`, display in a
  separate `viz.ts` (litmus: does deleting it change the graph?).
- `viz.ts` visualization + the stable `graph.html` shell + `data.js` output.

## Deferred (note, don't build yet)

- **digest / enrichment**: break `|`-list Value strings into element Values via
  unlabeled edges, as a background pass.
- **forgetting**, persistence, time/ordering, a surface syntax.

## Open questions to settle while implementing

- **Application identity:** canonical string form of a call (spacing, arg
  separator) so the same call always dedups to one node.
- **Passing arguments to `apply`:** single arg first (`v.apply("length")`); how
  multi-arg reads (`a.apply("strContains", b)`? a call builder?).
- **Distinguishing function-Values from data-Values:** by string form (`fn()`),
  by an edge to the `function` root, or both.
- **Value vs Application at the type level in TS:** one class with a kind flag,
  or two classes — decide once, keep the ergonomic handle (`NodeList`) working
  over both.
