# Reversible Function Graph — in plain words

## What this is

A graph made of nodes and arrows. The unusual part: when you run a function, the
*call itself* becomes a node, not just the answer.

```
paris ─────▶ length(paris) ─────▶ 5
length() ──▶ length(paris)
```

Three of those four boxes are ordinary things: `paris` is a piece of text, `5`
is a piece of text, and `length()` is the function, which is also just a node
you can point at. The fourth, `length(paris)`, is the call. It sits between the
input and the answer.

Because the call is a node, three different questions become the same kind of
question — follow arrows:

- What is the length of `paris`? Follow forward.
- What produced `5`? Follow backward.
- Everywhere `length` has ever been used? Follow forward from `length()`.

## The claim being tested

**Writing the call down is enough.**

Enough for what: enough that you never have to declare the shape of your data
before the data arrives. No tables to define, no types to declare, no record
layout, no version numbers, no "which one is current". The graph does not hold
any of that. A reader works it out afterwards by following arrows.

The claim goes both ways.

- **Forwards.** An engine that knows nothing about your data's shape can still
  carry any shape you like, because the record of *what function was run on
  what* has the three parts a table has. The function is the column. What you
  ran it on is the row. The answer is the cell.
- **Backwards.** Nothing you put in is lost, because the call sits between the
  input and the answer as a node you can stop on. Every answer points back at
  what produced it. Every function points at every use it has ever had.

Two things this is *not* claiming.

- Not that there is no shape at all. The engine fixes a small one before
  anything runs: two kinds of node, one rule about arrows, one answer per call,
  one data type. And you bring more shape yourself, in your choice of which
  functions to run.
- Not that the graph is a list of everything that happened. Ask the same
  question twice and the second time changes nothing, because the answer node is
  already there. So the graph holds the set of different questions asked, not a
  history of the asking.

## Quick start

```sh
npm install
./run.sh basic       # run one example, print output, rebuild data.js
./show.sh hubs       # same, then open the viewer in a browser
./run.sh             # list the examples
```

Needs Node, and a Linux desktop for `show.sh` (it calls `xdg-open`). TypeScript
runs straight through `tsx`. There is no build step.

## Two kinds of node

There is one `Node` class in the code. Every node is one of two kinds, and the
kind is worked out from the node's shape, never written down as a label:

| kind | what it is | how many arrows out | examples |
|---|---|---|---|
| **value** | a thing you can point at — a piece of data, or a function | as many as you like | `"5"`, `"paris"`, `"length()"` |
| **call** | one particular run of one function on particular inputs | exactly one | `"length(paris)"` |

The code and [README.md](README.md) call the second kind an *application*. Same
thing.

## The ten findings

These are called guarantees in the other document. They are ten views of one
idea, not ten separate ideas. The numbers never change, even if the order or
grouping does.

### What makes reading backwards possible

- **G1 — one answer per call.** A call has exactly one arrow going out. It can
  have as many arrows coming in as it likes. Values can have as many of both as
  they like.
- **G2 — the same string is always the same node.** Before making a node, the
  graph checks whether one with that exact text already exists, and reuses it if
  so. That is true for data and for calls alike: `paris` written twice is one
  node, and `length(paris)` run twice is one node. When two separate pieces of
  work land on one node, that node keeps the arrows from both, so nothing is
  forgotten by the sharing.

  This is the part everything else rests on. Two runs of `length(paris)` are one
  question, so they get one node, which is why asking *what produced 5* gives
  you one call back instead of a long list of identical-looking ones.

  Not to be confused with the shortcut in `apply` that skips re-running the
  function when the answer is already there. That shortcut only saves work.
  Delete that line and, as long as your functions always return the same answer
  for the same inputs, the stored graph comes out exactly the same.
- **G3 — arrows have no labels.** An arrow means something only by which way it
  points. Which argument was first, and what each argument was for, is written
  in the call's *text*, not on the arrows.
- **G7 — nothing is ever made to match on purpose.** Two things end up on one
  node when their text is identical, never because some code decided they are
  related. There are no matching rules and no join keys. Two things *failing* to
  land on one node is just as correct.
- **G10 — how deep it goes is not decided in advance.** Every arrow goes between
  a value and a call, so no call ever points straight at another call. A call
  inside a call is two calls side by side, not one nested in the other. There is
  no "level" stored anywhere; you get levels by walking. You can also add levels
  later in either direction without disturbing what is already there — cut
  something further and a level appears below it, or find that your whole source
  is part of something bigger and a level appears above it. `document →
  chapters → sections → paragraphs → sentences → words` and `source → rows →
  fields` are the same procedure run to different depths, which is why two
  sources of different depths can sit in one graph.

### What the engine refuses to keep

- **G4 — everything is text.** There is one data type: a string. A string is a
  number, or a list, or a date, only through the function you run on it. This is
  not "no rules": the engine fixes two kinds of node, the arrow rule, one answer
  per call, how a call's text is built, and one reserved character before
  anything runs. That much and no more.
- **G5 — the kind of a node is worked out, not stored.** Whether a node is a
  value or a call comes from its text and its arrows. Never a type field, never
  a flag.
- **G6 — what things mean lives in the data, not the engine.** The header row
  names the columns. A type is whatever a test function accepts. "Use the latest
  one" is a rule the reader chooses. The engine knows nothing about any of it —
  which does not mean nobody does. Your cutting functions, the header you read,
  the field names you found: all of that is shape, and the design chooses not to
  write it down rather than doing without it.
- **G9 — write everything down, decide what matters later.** Every path through
  the graph passes through calls, which say what the path *is*. So a silly path
  like `paris → length(paris) → 5 → suite #5` can be spotted and ignored, rather
  than being impossible to find. Nothing gets thrown away, merged, or rejected
  when it is written just because it looks like junk. A question asked later can
  make that decision — but only if writing kept the material.

### Why the call is a node at all

- **G8 — you can always walk back.** Every piece of work that was written down
  can be followed backwards, and nothing is worth building here if you cannot
  get back from its result. This is the one to give up last. Give it up and this
  is a different project.

## Where it doesn't work yet

The claim breaks wherever something written cannot be read back out. There is
one such place.

Ask the same question twice and the second time leaves no mark. The node is
already there, the arrows are already there, so two people asking for two
different reasons are indistinguishable afterwards. The graph holds the set of
different questions, with no count and no order. What that loses is the evidence
— who asked, from where, believing what — that you would need to tell apart two
meanings of the same word.

This is the one gap between "nothing is lost" and "everything can be read back
out". Closing it costs something the design currently has. Telling two identical
calls apart means they can no longer be identified by their text alone, which is
G2. Keeping the order of calls means the engine starts knowing about time, which
is G6.

## How you call things

The thing you are calling the function *on* is always the first argument. That
is what makes chaining work:

```ts
subject.apply("fn", ...rest)   ≡   fn(subject, ...rest)
```

```ts
const g = new Graph();
g.def("upper", s => s.toUpperCase());
g.def("length", s => String(s.length));

g.node("paris").apply("upper").log();            // PARIS
g.node("paris").apply("upper").apply("length");  // chains through the answer

g.node("5").from().log();          // [length(paris)]   ← the calls that made 5
g.node("5").from().from().log();   // [length(), paris] ← what went into them
g.node("upper()").to().log();      // [upper(paris)]    ← every use of upper
```

Going backwards takes **two steps**, not one: from the answer to the call, then
from the call to its inputs. That extra step is the whole point. The call is
somewhere you can stop and ask questions.

## What one call adds

Running function `F` on arguments `A…`:

1. work out the answer text `R` by running the function
2. build the call's text — `"F(A…)"` — always the same way, so that running the
   same call again produces the same text
3. find or make the node with that text
4. draw arrows in: from `F`, and from each argument
5. draw one arrow out: to `R`
6. everywhere in this, reuse existing nodes rather than making new ones

So one call adds **one call node, one arrow in per argument plus one from the
function, and one arrow out** — minus anything that was already there.

`strContains(a,b)` and `strContains(b,a)` are two different calls that end up
with the same set of arrows. Their *text* is what tells them apart (G3).

## Functions and data are not separated in the engine

To run something, nothing checks whether it is a function. The name is looked up
in the list of defined functions. Found means function, not found means error.

If you wanted to list all the functions, you would give them arrows to a
`function` node — which is more arrows, not a flag. That is not built, because
nothing needs it yet.

## When a function says no

A function returns text to record an answer, or `null` to say "this happened,
write nothing down". On `null`, the call gives back the one reserved `NOTHING`
node, and running anything on `NOTHING` gives back `NOTHING` again. So one
failed step carries through a chain without every function having to check for it.
The skipping happens in one place, not in every function.

This is what makes test functions work as types. A test function gives back
exactly what you gave it when the answer is yes, and nothing when the answer is
no. So running one marks a value as being of that type, for free, and a value
can be marked with as many types as you like. See `scenarios/types.ts`.

## The opinions

The findings above are the engine's half. This is your half: if the engine gives
you no shape, you supply all of it, and these are the conclusions so far about
how. Each could have gone another way, and any of them is worth reopening.

- **O1 — a list is text with `|` between the parts.** That is the one way of
  holding many things. Not arrays, not numbered slots, not handles.
- **O2 — one thing becomes many in two steps.** First cut the whole thing into
  one list (that is one call with one answer, so G1 is satisfied rather than
  dodged). Then take the parts out of the list one at a time, by what they say.
  `sequence` in `shapes.ts` does both steps.
- **O3 — give positions names, don't number them.** `record` names a fixed,
  known set of slots, so `lastOctet` is fine. Making up `0, 1, 2…` for a count
  you don't know in advance is the thing to avoid. See
  `anti-scenarios/text-index.ts` for what that looks like.
- **O4 — no nodes that exist only for the machinery.** Every argument you pass
  is either real data or a node the graph already made. A node that exists only
  to keep track of something is a warning sign: it means something outside the
  data is being represented inside it.
- **O5 — two ways in: by name, or by content.** When a container names its
  parts, the name becomes a function name — `record` does that in bulk for
  things split by a separator, and JSON keys or `key: value` lines do the same
  with no separator at all. When nothing names the parts, cut to a list and take
  them out by content. Records go the first way, collections the second.
- **O6 — a format is its cutting functions.** Grouping one format's cutting
  functions under a function named after the format is good: it keeps the names
  together, makes the format callable, and gives it somewhere to record what it
  knows about itself. What is not allowed is one format's function being shaped
  differently from another's — turning one format into another so you can reuse
  a path, or checking which format you have to decide what to *do* rather than
  which cutting function to use. Read any two format functions side by side and
  only the small inner functions should differ.

O2 and O3 were made real by deleting something. `graph.ts` has no `chop`.
Counting the pieces of a cut was the one way of doing it these opinions rule
out, so the method was removed rather than left sitting there as a temptation.
`anti-scenarios/text-index.ts` writes the counting loop out by hand, on purpose,
as the thing not to do.

## Three rules the engine enforces

They live in the engine on purpose. `apply` is what decides which kind each node
is, so these checks cannot be moved out without getting weaker.

- **Guard 1 — one kind per node.** A node is a value or a call, never both.
- **Guard 2 — arrows always cross.** Every arrow goes between a value and a
  call. Never value to value, never call to call. This is what keeps G10 true:
  no call ever points at another call, so nesting stays flat.
- **Guard 3 — a function name is defined once.** `def` fails if the name is
  taken. A function name is this graph's vocabulary, so defining one twice means
  one word with two meanings — and it would fail quietly, because calls already
  made keep the answer they already have while only new ones get the new
  behaviour. Learn a name once, then use it. Two sources needing different
  cutting need different names.

  The cost of Guard 3, stated plainly: one shared list of names, owned by
  whoever defines each one first, and never changed afterwards. A database is
  more forgiving: two tables can both have a `country` column meaning different
  things, and either one can be changed later. Here you inherit the names
  and can only choose which ones to look at.

## The layers

Each file above the engine can be deleted. The test: **delete it and the stored
graph comes out exactly the same, byte for byte.** Anything that fails that test
belongs in the engine. This is the claim applied to the code itself: if reading
is where shape comes from, then a reader must not be able to change what is
stored.

| file | what it does |
|---|---|
| `kernel.ts` | The whole engine — nodes, `apply`, arrows, node reuse, the answer-already-there shortcut, and the three rules above. If this is right, it rarely changes. |
| `graph.ts` | Getting around: walking with `from`/`to`/`nodes`/`values`, and printing things so you can read them. Passes the same API through. |
| `view.ts` | Looking at it: takes a picture of the whole graph into `data.js` for the viewer. Data only — the HTML page is written by hand. |
| `relate.ts` | Reads named relationships off the arrows — `follow`/`back`. Works from the arrows, never by reading call text. Creates nothing. |
| `shapes.ts` | Says what a piece of text *is*: `record` field layouts, `sequence` cut-and-extract, `versioned` edit chains. Unlike `relate.ts`, these call `g.def`, so they write. |

## The examples

Each one tests the claim on a different kind of data: a shape that has to be
imposed, and nothing in the engine to impose it with.

```sh
./run.sh <name>      # or ./show.sh <name> to open the viewer afterwards
```

| example | what it shows |
|---|---|
| `basic` | The core moves — run a function, chain, walk backwards, point at a function. |
| `hubs` | A few words run through a lot of functions, to see what a graph with heavily shared nodes looks like. An IP address is taken apart alongside it, for a shape that shares almost nothing with the rest. |
| `flat` | Functions calling functions — nested, but still flat — plus `NOTHING`, with counters showing that the shortcut works and that later steps never run on a failed value. |
| `types` | Types are found, not declared. A type is whatever its test function accepts, readable both ways: value to its types, type to its members. |
| `path` | Two ways of reading data that *don't* end up connected — two separate groups, because the data names the fields, not the code. Node reuse still bites inside the first one: `"robert smith"` and `"smith, robert"` land on the same `robert`. |
| `text` | Cutting prose three levels deep, two steps per level: `cut` joins the pieces into one `\|` list, then `paragraph`, `sentence` or `word` takes members out of that list. The driver splits nothing itself. Order becomes a node you can point at rather than something you recover from the container. |
| `timesheet` | A real app with no editable cell. An edit adds something new; "current" is a question you ask; history stays walkable. |
| `timesheet-cli` | The same thing, interactive, built on `shapes.ts`. Edit chains instead of version numbers. |
| `general-demo` | Six sources — prose, CSV with a header, CSV without, grouped CSV, JSON, and a `key: value` format — read by one technique. The cutting changes; the shape never does. Every piece can be followed back to the source it came from, and `"paris"` arrives as one node from all six. |

Two interactive programs:

```sh
npx tsx scenarios/timesheet-cli.ts
npx tsx anti-scenarios/general.ts
```

### Examples of how *not* to do it

They run, they work, and they are the wrong way. Kept on purpose: deleting them
would hide the comparison, and fixing them would erase the point. They run in
`runAll.sh` so they cannot quietly break.

```sh
./run.sh general        # names in anti-scenarios/ work too
```

| example | what is wrong with it |
|---|---|
| `text-index` | Cuts by counting `0, 1, 2…` until nothing comes back. It makes number nodes that then get shared across unrelated cuts, so `"1"` ends up being both a position and a word. Compare its picture to `text`. |
| `general` | Written before the opinions. It turns CSV rows into JSON objects so one path can handle both — the thing O6 forbids — and then identifies each record by the JSON text, which depends on the order the keys were added, so one record written two ways becomes two nodes. It also drops parts of the data it doesn't understand, which G9 forbids. Its one good part now lives in `gaze.ts`. |

There is a warning comment in `anti-scenarios/general.ts`: every function in it
is self-contained. The day one of them calls `g.apply` inside itself, it holds
on to the graph and goes stale when the graph is rebuilt.

## The viewer

This is where walking backwards gets checked by eye. If a shape really can be
read back out, you can see it here without it having been stored.

`view.ts` writes `data.js`. `graph.html` is a hand-written page that reads it.
Open it after a run, or reload a tab you already have open.

- Nodes are coloured by kind — value, function, call — so you can see the calls
  at a glance.
- Click a node to light up it and its neighbours. Clicking more adds to the
  selection.
- Four tabs: **triples**, **table** (rows against functions, sortable),
  **tables**, and **paths** (pick two nodes, see the routes between them,
  shortest first).

## Checking that nothing changed

```sh
./runAll.sh          # run every example, write all the output to dataAll.log
```

The output has no times and no randomness in it, and the interactive programs
are fed a fixed list of commands. So it is a file you can compare: change the
code, run it again, and `git diff dataAll.log` tells you whether anything
actually behaves differently.

## Files

```
kernel.ts        the engine
graph.ts         getting around (walking, printing)
view.ts          takes a picture -> data.js
gaze.ts          builds tables by reading them back out of the graph
relate.ts        reads named relationships off arrows
shapes.ts        says what records and edit chains are
graph.html       the viewer page (reads data.js)
scenarios/       runnable examples — how to do it
anti-scenarios/  they work; they are not how to do it
run.sh           run one example
show.sh          run one example + open the viewer
runAll.sh        run everything -> dataAll.log
```

`data.js` is rebuilt every run and is not tracked by git.

## Not built yet

Left out on purpose: a way to write a comma inside an argument (and a `|` inside
a list), a `function` node for listing all functions, saving to disk, time and
ordering, and a nicer syntax for writing calls.

Time and ordering is the one that touches the claim itself. It is what [Where it
doesn't work yet](#where-it-doesnt-work-yet) is missing, so whatever gets built
there changes the claim and not just the code.

Cutting a `|` list into its separate parts is built, as `sequence` in
`shapes.ts`. You run it deliberately; nothing does it in the background.

## Known broken

Facts about the code as it stands today, not about the model. Delete when fixed.

- **A comma inside an argument breaks the call's text.** A call is written as
  `fn(arg1,arg2)`, with nothing to mark a comma that is part of an argument. So
  `join2("a,b","c")` and `join2("a","b,c")` produce the same text, become one
  node, and the second one quietly gets the first one's answer.
- **The same argument twice loses its position.** Drawing an arrow that already
  exists does nothing, so `pair(x,x)` ends up with inputs `[pair(), x]` and the
  second `x` is gone. Anything that reads inputs by position — `relate.ts`,
  `scenarios/timesheet.ts` — is only correct while a call's arguments are all
  different.
