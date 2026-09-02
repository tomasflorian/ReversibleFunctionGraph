# Reversible Function Graph 2 — model spec

A rewrite of RFG where **everything is a node**: values, functions, and function
applications. Fully reified, so functions are addressable. Nothing is ever
duplicated, and nothing is lost. Eyeball this as the target before coding.

---

## One node kind, two roles (roles come from structure, not types)

There is **one `Node` class.** "Value" and "Application" are **roles you read off
a node's structure**, not TypeScript types and not a flag on the node:

- **Value** role (multi-output) — a *referenceable thing*: a datum (`"5"`,
  `"paris"`, `"paris|france"`) **or** a function (`"toLower()"`). Many things may
  point at it; it may feed many things. Its string is bare (`"5"`) or a function
  (`"fn()"`). *(prose name: **substance** — it endures and is referenced by many.)*
- **Application** role (single-output) — a *computation*: one specific call
  (`"isNumber(5)"`, `"strContains(paris france,france)"`) that resolves to exactly
  one result. Its string is a call `fn(args)`. *(prose name: **act** — one
  determinate happening.)*

You can always tell which role a node plays from its **string form** and its
**edges** — a call with one out-edge is an Application; anything else is a Value.
Single-output is **not** enforced by a type; it's an **invariant that `apply`
maintains** when it builds an Application.

## The guarantees

- **G1 — single output.** An **Application** has exactly **one output** and
  **unlimited inputs**. (Scoped to the Application role; Values are hubs and may
  fan out. Enforced by `apply`, not by a type.)
- **G2 — no duplication, no loss.** One node per distinct string. A shared hub
  keeps *all* its edges, so dedup never loses who produced or used it.
- **G3 — direction, not labels.** Edges carry meaning by **direction only** — no
  labels, no metadata. The *order and roles* of a call live in the Application
  node's **string**, not in its edges.
- **G4 — only strings.** The one data type is `string`. A string is a number, a
  list, etc. **only through the function applied to it.**
- **G5 — roles are read, never stored.** One `Node` class. Value and Application
  are roles read off structure (string form + edges); never a type, never a flag,
  never a field. `apply` maintains them; nothing records them.
- **G6 — meaning lives in the data, not the engine.** The header names the
  columns. A type is whatever a predicate admits. "Latest wins" is a rule the
  reader picks. The engine knows nothing of schema, type, or time.
- **G7 — convergence is never engineered.** Things fuse because their strings are
  equal, never because code decided they are related. No keys, no schema, no
  matching rules — and two things failing to converge is equally correct.
- **G8 — reversibility is absolute.** Every recorded computation can be walked
  backwards. Nothing may be built that produces a result you cannot get back
  from. This is the purpose, not a feature.

## Calling: UFCS convention

```
subject.apply("fn", ...restArgs)   ≡   fn(subject, ...restArgs)
```

- The **subject is always arg 0** (makes chaining work; the Application dedups by
  its full string regardless of which value you entered from).
- The function is named as a string; it may carry cosmetic parens (`"strContains()"`).
- `g.node("paris france").apply("strContains", "france")` = `strContains("paris france", "france")`.

## What one `apply` builds

Applying function `F` to argument(s) `A…` produces:

1. compute the result string `R = fn(args)`
2. find-or-create the **Application** node whose string is the canonical call
   `"F(A…)"` (built deterministically by `apply`, so identical calls dedup)
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

- Value-role nodes: `5`, `isNumber()`, `true`
- Application-role node: `isNumber(5)` → its one output is `true`
- Inputs are unordered edges; order/roles are read from the string `"isNumber(5)"`.

### Multi-argument — `strContains(paris france, france)`

- One Application node, **three** input edges (`strContains()`, `paris france`,
  `france`), **one** output edge (`true`).
- `strContains(a,b)` and `strContains(b,a)` are different Application nodes with
  the same edge set — the **string** tells them apart (G3).

## Navigation (reverse is free)

- Every edge is recorded once, indexed from **both ends** → walk either way.
- **Forward:** Application → its result (one edge out).
- **Reverse:** from a Value, walk incoming edges to the Applications that
  **produced** it (a hub → many) and outgoing edges to Applications that **use**
  it as input.
- **Function addressability (the point of the rewrite):** a function Value
  (`toLower()`) has edges to every Application that uses it, so "what has toLower
  been applied to?" and "what produced `true`?" are plain walks.

## Function vs data: don't distinguish in the core

- **To apply:** no node check. `apply("toLower", …)` looks up `"toLower"` in the
  impl registry (name → JS function). Present ⇒ function; absent ⇒ error.
- **To introspect** ("list functions", "what functions produced X"): use a
  `function` root Value (functions have an edge to it), added only when you
  actually want to enumerate functions. Structural, not a flag. **Deferred** until
  introspection needs it.

## Decisions (resolved)

- **One `Node` class; Value/Application are structural roles**, read from string
  form + edges. Single-output enforced by `apply`, not by a type.
- **Application identity** = the canonical call string, built by `apply`. Same
  call ⇒ same node. (Same delimiter/escaping caveat as `|`, deferred.)
- **Multi-arg** = UFCS: `subject.apply("fn", ...rest)` ≡ `fn(subject, ...rest)`;
  subject is arg 0.
- **Function/data distinction** is not in the core — registry for `apply`,
  `function` root for introspection (deferred).

## Deferred (note, don't build yet)

- Proper escaping for the arg-separator (and `|`).
- `function` root + function introspection.
- **digest / enrichment**: break `|`-list Value strings into element Values via
  unlabeled edges, as a background pass.
- persistence, time/ordering, a surface syntax.

## Known broken (implementation, not model — delete when fixed)

- **Argument separator is unescaped.** `apply` keys an Application as
  `fn(args.join(","))`, so an argument containing `,` collides with a different
  call: `join2("a,b","c")` and `join2("a","b,c")` are one node, and the second
  silently receives the first's memoized result.
- **A repeated argument loses its position.** `linkTo` skips an edge that already
  exists, so `pair(x,x)` has inputs `[pair(), x]` — arg1 is gone. Readers that
  index inputs positionally (`relate.ts`, `scenarios/timesheet.ts`) are correct
  only while a call's arguments are distinct.
