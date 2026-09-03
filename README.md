# Reversible Function Graph

A graph where **everything is a node** — values, functions, and function calls
alike. Nothing is duplicated, nothing is lost, and every computation can be
walked backwards.

Apply a function and you don't just get a result; you get a permanent record of
the call, wired into the graph. So "what is `length("paris")`?" and "what
produced `5`?" and "everywhere `length` has ever been used" are all the same
kind of question — a walk over edges.

This is an exploration, not a specification. Nothing here was handed down; it is
where the thinking currently stands, arrived at by building. The numbered lists
below are load-bearing — build to them rather than around them — and they are
also the most interesting things to argue with. Proposing that one of them
should change is not friction, it is how this moves. What is asked is that they
change by proposal rather than by drift.

```
paris ─────▶ length(paris) ─────▶ 5
length() ──▶ length(paris)
```

`paris` and `5` are values. `length()` is a value too — that's the point, it's
addressable. `length(paris)` is the **application**: the reified call.

## Quick start

```sh
npm install
./run.sh basic       # run a scenario, print output, regenerate data.js
./show.sh hubs       # same, then open the interactive viewer
./run.sh             # list all scenarios
```

Requires Node and a GNU/Linux desktop for `show.sh` (it uses `xdg-open`).
TypeScript runs directly through `tsx` — there is no build step.

## The model

*This section and **Opinions** below it are where the reasoning lives. When they
and the code disagree, one of the two has moved without the other — worth
stopping to find out which, rather than assuming the code is right. Everything
after that — layers, scenarios, viewer — is description, and describes only
today.*

One `Node` class. **Value** and **Application** are *roles read off structure*,
never type tags:

| role | is | outputs | example |
|---|---|---|---|
| **Value** | a referenceable thing — a datum *or* a function | many | `"5"`, `"paris"`, `"length()"` |
| **Application** | one specific call | exactly one | `"length(paris)"` |

Ten findings hold the model together. They are called guarantees because the
kernel currently keeps them and much of the design leans on their holding — not
because they were decided in advance:

- **G1 — single output.** An Application has one output, unlimited inputs.
  Values are hubs and fan out freely.
- **G2 — no duplication, no loss.** One node per distinct string. A shared hub
  keeps *all* its edges, so dedup never forgets who produced or used it.
- **G3 — direction, not labels.** Edges carry meaning by direction only. The
  order and roles of a call live in the Application's *string*, not its edges.
- **G4 — only strings.** The one data type is `string`. A string is a number or
  a list only through the function applied to it.
- **G5 — roles are read, never stored.** Value and Application come off
  structure — string form plus edges. Never a type, never a flag, never a field.
  `apply` maintains them; nothing records them.
- **G6 — meaning lives in the data, not the engine.** The header names the
  columns. A type is whatever a predicate admits. "Latest wins" is a rule the
  reader picks. The engine knows nothing of schema, type, or time.
- **G7 — convergence is never engineered.** Things fuse because their strings
  are equal, never because code decided they are related. No keys, no schema, no
  matching rules — and two things failing to converge is equally correct.
- **G8 — reversibility is the point.** Every recorded computation can be walked
  backwards, and nothing is worth building here that produces a result you
  cannot get back from. This one is closest to load-bearing: give it up and the
  project is a different project.
- **G9 — record without judgment; select at read time.** Every path is qualified
  by the applications it crosses, so a meaningless path (`paris → length(paris) →
  5 → suite #5`) is *identifiable* rather than absent. So nothing gets dropped,
  merged away, or refused at write time for looking like noise — a query can
  make that call later, but only if the write kept it.
- **G10 — depth is not pre-determined.** Every edge crosses value ↔
  application, so no application ever points at another: a nested call is two
  applications side by side, never one inside the other. Levels are not stored
  anywhere, only walked — whatever depth exists came from what the caller cut.
  It can also grow later, in either direction, without disturbing what is
  already there: a further cut adds a level below, and a source that turns out
  to be part of something larger gains one above. How far to descend is the
  caller's decision, made per source as a chain of splitters. The model
  neither knows nor records how long that chain was — which is what lets two
  sources of different depths share one graph. `document → chapters → sections
  → paragraphs → sentences → words` and `source → rows → fields` are one
  procedure at two depths, not two procedures.

### Calling

UFCS — the subject is always argument 0, which is what makes chaining work:

```ts
subject.apply("fn", ...rest)   ≡   fn(subject, ...rest)
```

```ts
const g = new Graph();
g.def("upper", s => s.toUpperCase());
g.def("length", s => String(s.length));

g.node("paris").apply("upper").log();            // PARIS
g.node("paris").apply("upper").apply("length");  // chains through the result

g.node("5").from().log();          // [length(paris)]      ← the calls that made 5
g.node("5").from().from().log();   // [length(), paris]    ← their inputs
g.node("upper()").to().log();      // [upper(paris)]       ← every use of upper
```

Reverse is **two hops** — value → Application → inputs — because the Application
sits in between. That indirection *is* the win: the call is a node you can land
on and query.

### What one `apply` builds

Applying `F` to arguments `A…`:

1. compute the result string `R = fn(args)`
2. find-or-create the Application node whose string is the canonical call
   `"F(A…)"` — built deterministically, so identical calls dedup
3. wire unlabeled directional edges: `F → App` and `A → App` for every argument,
   then `App → R`
4. dedup throughout: same call ⇒ same Application, same string ⇒ same Value

So one call adds **1 Application node + (1 + #args) input edges + 1 output
edge**, all deduplicated. `strContains(a,b)` and `strContains(b,a)` are different
Applications with the same edge set — the *string* tells them apart (G3).

### Function vs data: not distinguished in the core

To apply, there is no node check: `apply("toLower", …)` looks up `"toLower"` in
the impl registry. Present ⇒ function, absent ⇒ error. To *enumerate* functions
you would give them edges to a `function` root — structural, not a flag — and
that is deferred until introspection actually needs it.

### NOTHING

An implementation returns a string to record a result, or `null` to say "this
happened, leave no trace." On `null`, `apply` yields the one reserved `NOTHING`
node, and applying anything to `NOTHING` short-circuits back to `NOTHING`. So a
failed step carries through a chain without every function guarding for it — the
skip lives in `apply`, not in the implementations.

This is what makes predicates work as **types**: a predicate is
identity-on-success, silent on failure, so passing one marks a value with that
type for free, and a value can carry many types at once. See `scenarios/types.ts`.

## Opinions

### Two hats

Two hats, and the guarantees and the opinions fit different ones. Wearing the
**kernel builder** hat, G1–G9 are the shape of the thing being kept. Wearing the
**kernel user** hat — writing a layer, a scenario, anything above `kernel.ts` —
they are facts about the material, and what they leave undone becomes the user's
job:

| the kernel stays out of | which leaves the user to |
|---|---|
| holding more than one type (G4) | impose types — predicates, records, shapes |
| returning more than one output per call (G1) | build many-ness deliberately, in two rungs |
| relating anything (G3, G7) | choose functions that make the useful things collide |
| supplying meaning (G6) | name things — from literals, or from the data |
| selecting anything (G9) | select, and do it at query time |

Reading a guarantee as an instruction to the user is the easy mistake. G6 says
the engine supplies no meaning; it does not say "be data-driven."
`record("|", ["emp","date"])` is a hardcoded field list and sits perfectly well
with G6. Whether names come from literals or off a CSV header is a *user*
question, and user questions are answered below, by opinion.

Which is also why the user's side is so open. Constraining it would mean the
kernel doing the constraining, and that is the one thing G4 gives up. The room
above the kernel is what the guarantees buy — so that side gets opinions, which
are meant to be argued with, rather than findings the kernel is holding steady.

### The opinions

They exist because an unopinionated core offers too many ways to say one thing,
and a pile of equivalent options is what makes upper layers hard to design. Each could have gone another way, and any of them is fair
game to reopen — they are conclusions from a handful of experiments, not results.

- **O1 — the list is the collection.** A `|`-joined string is the one
  representation of many-ness. Not arrays, not indices, not nested handles.
- **O2 — one becomes many in two rungs.** First cut the container into a list
  (one application, one output — G1 satisfied rather than worked around), then
  take members out of the list by content. `sequence` in `shapes.ts` is both
  rungs.
- **O3 — name positions, don't count them.** `record` names a fixed, known set
  of slots, so `lastOctet` is fine. Inventing `0, 1, 2…` for a count you don't
  know in advance is the move this avoids — see `scenarios/text-index.ts` for
  what it looks like.
- **O4 — no synthetic values.** Every argument to an application is data, or a
  node the graph already made. A value node that exists only as bookkeeping is a
  smell — it means something outside the data is being represented inside it.
- **O5 — two ways in: by name, or by content.** When a container names its
  parts, the name becomes a function name — `record` is the batch case for
  separator-delimited slots, and JSON keys or `key: value` lines do the same
  thing with no separator at all. When nothing names them, cut to a list and
  take members by content. Records take the first way in, collections the
  second.

O2 and O3 were made real by a deletion: `graph.ts` has no `chop`. Counting a cut
was the one way of saying it these opinions rule out, so the method went away
rather than sitting there as a tempting alternative. `scenarios/text-index.ts` writes the counting loop out by hand, on
purpose, as the shape to avoid.

## Layers

Each layer is deletable. The litmus: **delete it and the stored graph is
byte-identical.** Anything that fails that test belongs in the kernel.

| file | role |
|---|---|
| `kernel.ts` | The whole engine — node, `apply`, edges, dedup, memoization, and the two guards. If this is right, it rarely changes. |
| `graph.ts` | Navigation: `Tree` walking (`from`/`to`/`nodes`/`values`), `outputsOf`, and the console display that makes it readable (`log`/`toString`). Re-exports the same API. |
| `view.ts` | How you look at it: `snapshot()` of the whole graph, written to `data.js` for the viewer. Data only — the HTML shell is hand-written. |
| `relate.ts` | Reads named relations off the edges — `follow`/`back`. Reads relations from **structure**, never by parsing call strings. Creates nothing. |
| `shapes.ts` | Declares what a string *is*: `record` field-shapes, `sequence` cut-and-digest, `versioned` edit-chains. Unlike `relate.ts`, these call `g.def` — they write. |

The two guards live in the kernel on purpose: `apply` is what assigns the roles
they check, so they can't be peeled off without weakening them.

- **Guard 1 — role.** A node is a value or an application, never both.
- **Guard 2 — bipartite.** Every edge crosses value ↔ application. This is
  where G10 is enforced: no application ever points at another, so nesting stays
  *flat*.
- **Guard 3 — a function is defined once.** `def` throws if the name is already
  taken. A function name is the graph's vocabulary, so defining one twice means
  two meanings for one word — and it fails silently, because calls already made
  keep their memoized answers while only new ones get the new behaviour. Learn a
  name once, then use it. Two sources needing different splitters need different
  names.

## Scenarios

```sh
./run.sh <name>      # or ./show.sh <name> to open the viewer after
```

| scenario | shows |
|---|---|
| `basic` | The core moves — forward apply, chaining, reverse walks, function addressability. |
| `hubs` | A small set of words run through a lot of functions, to see what a hub-heavy graph looks like. An IP record is parsed alongside it, for a shape that shares almost nothing with the rest. |
| `flat` | Functions calling functions — nested but flat — plus `NOTHING`, with counters proving memoization and that downstream never runs on a failed value. |
| `types` | Types are discovered, not declared: a type is the extension of a predicate, readable both ways (value → its types, type → its members). |
| `path` | Two ingestion methods that *don't* converge — they are separate islands, because the data names the fields, not the code. Dedup still bites inside method 1: `"robert smith"` and `"smith, robert"` land on the same `robert`. |
| `text` | Cutting prose three levels deep in two rungs per level: `cut` joins the pieces into one `\|`-list value, then a per-level extraction (`paragraph`, `sentence`, `word`) takes members out of it. The driver splits nothing itself — every piece comes off a list the graph computed — and order becomes an addressable node rather than something recovered from the container. |
| `text-index` | **Kept deliberately as the shape to avoid.** The same cut keyed by position, counting `0, 1, 2…` until nothing comes back. It works, but manufactures integer value nodes that fuse across unrelated cuts, so the node `"1"` ends up being both a position and a word. Do not "fix" this one — compare its picture to `text`. |
| `timesheet` | A real app: no mutable cell. An edit is an append; "current" is a latest-wins query; history stays walkable. |
| `timesheet-cli` | The same, interactive, built on `shapes.ts`. Edit chains instead of sequence numbers. |
| `general-demo` | Six sources — prose, headered CSV, unheadered CSV, grouped CSV, JSON, and a `key: value` format — parsed by one technique. The splitter changes; the shape never does. Every leaf climbs back to the source it came from, and `"paris"` arrives as a single node from all six. |

Two interactive CLIs:

```sh
npx tsx general.ts               # generic JSON/CSV loader
npx tsx scenarios/timesheet-cli.ts
```

`general.ts` keeps a list of raw sources as ground truth and rebuilds the whole
graph from them on every change — the graph is a pure function of
(sources + functions). Tables are *gazed* back out of the graph by column
signature, never stored. CSV headers and JSON keys land under the same function
names, so sources merge when their keys match and stay separate when they don't.

Note its tripwire comment: every impl there is pure. The day one calls `g.apply`
inside itself, it closes over the graph and goes stale on rebuild — that's the
signal to pass impls a context instead.

## The viewer

`view.ts` writes `data.js`; `graph.html` is a stable hand-written shell that reads
it. Open it after a run, or reload an already-open tab.

- Nodes are colored by role — value, function, application — so the reification
  is visible at a glance.
- Click a node to highlight it and its neighbors; multi-select accumulates.
- Four tabs: **triples**, **table** (subject × function pivot, sortable),
  **tables**, and **paths** (pick two nodes, find the paths between them —
  shortest first, widen for longer).

## Regression log

```sh
./runAll.sh          # runs every scenario + general, captures output to dataAll.log
```

The log is deterministic — no timestamps, no randomness, interactive CLIs fed a
fixed command script. So it's a diffable snapshot: refactor freely, re-run, and
`git diff dataAll.log` tells you whether behavior actually changed.

## Layout

```
kernel.ts        the engine
graph.ts         navigation (Tree, display)
view.ts          snapshot -> data.js
relate.ts        reads named relations off edges
shapes.ts        declares records and edit-chains
graph.html       viewer shell (reads data.js)
general.ts       generic JSON/CSV loader CLI
scenarios/       runnable demos
run.sh           run a scenario
show.sh          run a scenario + open the viewer
runAll.sh        run everything -> dataAll.log
```

`data.js` is generated on every run and is not tracked.

## Not built yet

Deliberately deferred: escaping for the argument separator (and `|`), a
`function` root for enumerating functions, persistence, time and ordering, and a
surface syntax.

Digest/enrichment — splitting `|`-list values into element values — is built, as
`sequence` in `shapes.ts`. It is driven explicitly rather than run as a
background pass.

## Known broken

Facts about today's implementation, not the model. Delete when fixed.

- **The argument separator is unescaped.** `apply` keys an Application as
  `fn(args.join(","))`, so an argument containing `,` collides with a different
  call: `join2("a,b","c")` and `join2("a","b,c")` are one node, and the second
  silently receives the first's memoized result.
- **A repeated argument loses its position.** `linkTo` skips an edge that
  already exists, so `pair(x,x)` has inputs `[pair(), x]` — arg1 is gone.
  Readers that index inputs positionally (`relate.ts`,
  `scenarios/timesheet.ts`) are correct only while a call's arguments are
  distinct.
