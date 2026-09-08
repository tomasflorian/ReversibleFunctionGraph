# Reversible Function Graph

## What this is

You run a function. The call gets written down as one line:

```
["length","paris","5"]
```

A function, its arguments, its answer. That line is an **atom**, and atoms are
the only thing this project stores.

A **graph** is what a reader makes of them. Expanding that one atom gives four
boxes and three arrows:

```
length ──fn────▶ (the call) ──result──▶ 5
paris ──arg0───▶ (the call)
```

Three of those boxes are ordinary things: `paris` is a piece of text, `5` is a
piece of text, `length` is the function — which is also just a node you can point
at. The fourth is the call itself, sitting between the input and the answer.

Because the call is a node, three different questions become the same kind of
question — follow arrows:

- What is the length of `paris`? Follow forward.
- What produced `5`? Follow backward.
- Everywhere `length` has ever been used? Follow forward from `length`.

The graph is never stored anywhere. It is derived, every time somebody looks.

## The claim being tested

**Writing the call down is enough.**

Enough for what: enough that you never have to declare the shape of your data
before the data arrives. No tables to define, no types to declare, no record
layout, no version numbers, no "which one is current". A reader works it out
afterwards by following arrows.

The claim goes both ways.

- **Forwards.** An engine that knows nothing about your data's shape can still
  carry any shape you like, because the record of *what function was run on what*
  has the three parts a table has. The function is the column. What you ran it on
  is the row. The answer is the cell.
- **Backwards.** Nothing you put in is lost, because the call sits between the
  input and the answer as a node you can stop on.

Not claiming there is no shape at all — the atom fixes a small one, and you bring
more yourself in choosing which functions to run. And not claiming the graph is a
list of everything that happened: ask the same question twice and the second time
changes nothing.

## The atom

```
[ fn, ...args, result ]
```

At least three slots, all strings. Slot 0 is the function, the last slot is the
result, everything between is the arguments **in order**.

```
["length",    "cat",      "3"]
["upper",     "cat",      "CAT"]
["hasLetter", "cat", "z", "false"]
```

There is no role field and no label field: role falls out of position. An atom is
a claim — this function, applied to these arguments, gave this answer. Usually it
is the record of a call that ran, but nothing in the format says so, and a
hand-written line is as good as a generated one.

**Identity is the atom without its last slot**, compared element by element.

```
identity(["hasLetter","cat","z","false"]) = ["hasLetter","cat","z"]
```

Not a string, not a hash, no canonical form for anybody to agree on — and an
encoding is exactly the place two implementations can disagree. Nothing is ever
joined into a string and read back apart, so there is no separator to reserve, no
quoting rule, and no comma to get wrong.

**A function that returns nothing writes nothing down.** No atom, no record that
the question was asked. A null is a fact about a question rather than about the
world, and the set of questions a function declines is unbounded — most strings
are not an IP — so recording them would grow the file with what was *asked*
instead of with what was *found*.

**One atom per line**, plain text, no wrapper. Each line is one JSON array of
strings, which every language can write with one call and a person can type
without thinking about it. A single JSON document would only parse whole, so a
file caught mid-write would stop being a graph at all; one atom per line means a
truncated file loses its last partial line and stays valid. **Any prefix of the
file is a smaller graph, never a damaged one.**

Not a promise that the graph stays connected — two atoms sharing no values make
two islands, which is normal. A promise that every island is made of whole facts.
Disconnected is expected; incomplete is what atoms rule out.

## Three roles

Not client and server. Three jobs, touching one plain file:

```
producers  ->  the pile  ->  readers
```

A **producer** writes atoms. Anything that can print lines of text qualifies —
any language, or a person typing observations by hand. Its insides can be as
complicated as you like: millions of lines, internal state, whatever the work
takes. What leaves it is atoms. **A producer never reads the pile**, never
coordinates with another producer, and never has to dedupe — merging is
idempotent, so emitting the same atom a thousand times is free.

The **pile** is the concatenation of what the producers wrote. It has no
vocabulary — it never runs a function and may not even have the function — so it
cannot check that an answer is *right*, only that it does not contradict one it
already holds. It can be a running service, a folder, or `cat a.txt b.txt`.

A **reader** expands the pile and draws or walks it. Everyone holding the same
atoms holds the same graph, so the graph itself never has to travel.

`pile.js` is the middle one, running:

```
POST   /atoms   producers append. Body is atom lines, exactly as the file holds them
GET    /atoms   text/event-stream — replays the whole pile, then streams arrivals
DELETE /atoms   empty it. An operator action, never a producer's
```

It drops a line it already holds, byte for byte, so a producer re-sending its
whole output is free. That is housekeeping, not meaning: it is textual, so two
atoms with the same call and *different* answers are both kept — nothing there is
entitled to pick a winner. And it keeps arrival order, because order carries no
meaning and there is nothing to sort.

## Expanding

`expand` turns one atom into nodes and edges:

```
nodes:  fn                a function
        each argument     a value
        the atom itself   a call
        the result        a value

edges:  fn      -> call     slot: fn
        arg i   -> call     slot: arg0, arg1, ...
        call    -> result   slot: result
```

**The edges carry their slot.** This is where argument order survives expansion.
Without it, `sentence(x, x)` draws the same arrow twice, the duplicate does
nothing, and the call comes back with one argument where it had two.

Expanding a set of atoms is the union of expanding each one, nodes deduplicated
by identity and edges by `(from, to, slot)`.

**The load-bearing bit: `expand` reads only the atom.** It never consults the
graph built so far. Everything below follows from that and nothing else.

## Merging is concatenation

Merging two atom files is gluing them together. There is no reconciliation step;
`cat a.txt b.txt` is a complete and correct merge.

Because expanding a set is a union over its elements:

```
expand(A ∪ B) = expand(A) ∪ expand(B)
```

Three things follow: merging the same file twice does nothing, the order of
merging is irrelevant, and the grouping is irrelevant. **The graph is a function
of the set of atoms, never of the sequence.** So "send everything again" and
"send only what is new" produce the same result, which makes a delta scheme a
size optimization and never a correctness one.

It also means there is no big graph and no small graph on disk. There is only:
what was merged into the graph being looked at, at this moment.

## Where the meaning is

An atom is complete in itself. `length(cat) = 3` is a whole fact and says nothing
about any other atom.

A node is the opposite kind of thing. `cat` is interesting because it appears in
four atoms. `3` is interesting because it is the length of `cat` *and* the last
octet of an IP *and* a timesheet sequence number. That fact is in no single atom.
It cannot be written down — it is a property of the set, and it comes into
existence only when you group.

> atoms hide nodes

The atom list *contains* every collision and *expresses* none of them. Grouping
turns "this string appears eight times" into "one node with eight arrows", which
is the entire phenomenon here. And the reverse is why both halves are needed:
every question starts at a node — click one, anchor on one, walk from one — and
none of them exist in the file. Grouping is not an optional rendering step; it is
what creates the places you can stand.

The two halves are not mirror images, and the asymmetry is the useful part. An
atom means something on its own, but only because its parts meant something
before the system saw them: `length` means what it means because a person chose
the name. A node means nothing on its own — its entire content is which atoms it
appears in.

**So meaning enters through the atoms and is made at the nodes.** The atoms could
have come from anywhere. The nodes are the system's own contribution — the only
facts here that nobody wrote.

Nearly every system has this duality; noticing it is not a finding. What is
unusual is that **the atoms are authored and the connections are not.** Most
systems author both — you declare the foreign key, you draw the edge, you write
the link. Here every atom is deliberate and not one connection is. They happen
because two strings are identical, and can be neither caused nor prevented.

So the bet is not "meaning is in connections." It is *meaning is in the
connections I did not make.*

**The test.** A framing is real if it predicts things arrived at independently.
This one does, four times, and all four were in the code before it was written
down:

- Connections are not authored → there can be no join keys and no matching rules.
- Unauthored connections need no agreement → merging needs no coordination, and
  is therefore concatenation.
- Collision happens on exact text → how a call is written down is load-bearing,
  and the old comma bug was structural rather than cosmetic.
- Anything added later must arrive as atoms → "who asked" can only be recorded as
  more calls, never as a field on the side.

## What holds

Ten views of one idea, not ten separate ideas.

**Reading backwards**

- **One answer per call.** A call has one arrow out and as many in as it likes.
  Nothing enforces this — see *Known limits*.
- **Identity comes from contents.** A value's identity is its text; a call's is
  its argument list. Give calls arbitrary ids instead — a counter, a uuid — and
  merging two files means matching meaningless ids across them, which is a real
  and hard problem. Content identity is what makes merging one line long.
- **Arrows are derived, never authored.** Nobody writes an arrow, or its slot.
  The arrow appears because a value sat in an atom; the slot says where it sat.
- **Nothing is ever made to match on purpose.** Two things land on one node when
  their text is identical, never because code decided they are related. No
  matching rules, no join keys — and two things *failing* to land on one node is
  just as correct.
- **How deep it goes is not decided in advance.** Every arrow goes between a
  value and a call, so no call points straight at another. A call inside a call
  is two calls side by side, not one nested in the other, and levels can be added
  later in either direction without disturbing what is there.

**What is refused**

- **Everything is text.** One data type. A string is a number, or a list, or a
  date, only through the function you run on it.
- **A node's kind is worked out, not stored.** It comes from position in the
  atom, never from a type field or from how the node is spelled. Being a
  *function* is a property of an edge: a node is a function in a call because its
  arrow filled that call's `fn` slot, so one node can be a function in one call
  and a value in another, with both lives hanging off it.
- **What things mean lives in the data, not the engine.** The header row names
  the columns. A type is whatever a test function accepts. "Use the latest one"
  is a rule the reader chooses.
- **Write everything down, decide what matters later.** Every path passes through
  calls, which say what the path *is*, so a silly path can be spotted and ignored
  rather than being impossible to find. Nothing is thrown away for looking like
  junk — with the one exception that a function which declines writes nothing.

**Why the call is a node at all**

- **You can always walk back.** Every piece of work written down can be followed
  backwards. This is the one to give up last. Give it up and this is a different
  project.

## The opinions

The findings above are the engine's half. This is your half: if the engine gives
you no shape, you supply all of it. Each could have gone another way.

- **O1 — a list is text with `|` between the parts.** Not arrays, not numbered
  slots, not handles.
- **O2 — one thing becomes many in two steps.** First cut the whole into one list
  (one call, one answer). Then take the parts out of the list one at a time, by
  what they say. `sequence` in `shapes.ts` does both.
- **O3 — give positions names, don't number them.** `record` names a fixed known
  set of slots, so `lastOctet` is fine. Making up `0, 1, 2…` for a count you
  don't know in advance is the thing to avoid.
- **O4 — no nodes that exist only for the machinery.** A node that exists only to
  keep track of something means something outside the data is being represented
  inside it.
- **O5 — two ways in: by name, or by content.** When a container names its parts,
  the name becomes a function name. When nothing names them, cut to a list and
  take them out by content. Records go the first way, collections the second.
- **O6 — a format is its cutting functions.** Grouping one format's cutters under
  a function named after the format is good. What is not allowed is one format's
  function being shaped differently from another's — turning one format into
  another to reuse a path, or checking which format you have to decide what to
  *do* rather than which cutter to use.

O2 and O3 were made real by deleting something: there is no `chop`. Counting the
pieces of a cut was the one way these opinions rule out, so the method was
removed rather than left as a temptation.

## Quick start

```sh
npm install
npm start     # the pile, at http://localhost:8000. Open it, leave it running
./run.sh      # in another terminal: run the producer, send its atoms to the pile
./runAll.sh   # write snapshots/combined.atoms — the regression artifact
```

Open the page first and then run the producer, and you watch the picture fill in
as the atoms arrive. Run `./run.sh` again and nothing happens, which is the point
— merging is idempotent, so re-sending everything is free.

Anything that can print lines is a producer, and literally so. There are four
here, and the pile cannot tell them apart:

```sh
./producers/atom.sh notedBy paris tomas   | curl -X POST --data-binary @- localhost:8000/atoms
./producers/repo.sh                       | curl -X POST --data-binary @- localhost:8000/atoms
dotnet run --project producers/timesheet  | curl -X POST --data-binary @- localhost:8000/atoms
./run.sh                                  # scenarios/combined.ts, which posts for itself
```

`atom.sh` takes a call as arguments and prints one line. `repo.sh` is bash,
written by hand — no library, no kernel, nothing imported.

`producers/timesheet` is C#, and makes the other half of the point: **an atom is
a structured log line.** Nothing in that program is built around RFG. There is a
record, a rate card, some arithmetic and an interface — the code you would write
anyway — and the only trace of the graph is the word `Atoms` beside work that has
already happened. Delete every one of those lines and it is still a working
program; it just stops saying what it did. Three ways, getting progressively out
of the way:

```csharp
Atoms.Log("dayOfWeek", date, date.DayOfWeek);        // say it afterwards
var rate = Atoms.Call("rate", proj, () => rates[proj]);  // wrap the call
var cost = pricing.Cost(row);   // nothing at the call site at all
```

The third is an interface behind a `DispatchProxy`: `Pricing` is a plain class
with no reference to anything here, the calling code holds an `IPricing` and has
no idea it is being recorded, and an atom is written per call. That is as far out
of the way as it goes without a source generator.

There is no `Def`, no vocabulary, no memo and nothing to inherit from — RFG is a
sink, not a framework. The one thing that cannot be automated is that the graph
has one data type, so somebody has to say how a `decimal` or a `DateOnly` becomes
text. That decision lives in one place, `Atoms.cs`, instead of at every call
site, and a type nobody has decided about is refused rather than guessed at.

Run all four into one pile and the graph comes out like this:

```
TypeScript  420 atoms   420 new
bash         25 atoms    11 new     14 already held
C#           36 atoms    17 new     19 already held
by hand       1 atom      1 new
C# again     36 atoms     0 new

709 nodes / 1440 edges  ->  764 / 1527
```

The C# producer sends 36 lines and only 23 of them are distinct, because without
a framework it has no memo and says `dayOfWeek(2026-08-25)` once per row that
mentions that date. Nothing anywhere minds. A producer is allowed to be exactly
that dumb — it never has to dedupe, never has to know what it said before, and
never has to ask.

The duplicates are the interesting part. bash recomputes `length` and `upper`
over the anagram words; C# works out `year` and `month` of the same dates. Those
are the same calls, so they are the same atoms, so the pile already holds them
and the graph does not move. Agreement between producers needs no protocol — it
happens or it does not, and either way merging is a concatenation.

One timesheet record ends up with seven calls hanging off it, five from the
TypeScript producer and two from the C# one, neither knowing the other exists:

```
bob|2026-08-25|projX|8|1  -arg0->  emp   date   proj   hours   seq      (TypeScript)
                          -arg0->  cost  shift                          (C#)
```

The C# producer also has an `isWeekend` that returns null for all three dates, so
it contributes nothing at all — `isWeekend` is not in the graph, not as a node
and not as an absence. A decline writes nothing down.

There is one producer here and no arguments to pass: `scenarios/combined.ts`.
`runAll.sh` needs nothing running — it writes a file, which is what makes the
regression artifact independent of any server. The viewer pulls `vis-network`
from a CDN, so it wants a network connection the first time. TypeScript runs
straight through `tsx`. There is no build step.

## How you call things

The thing you are calling the function *on* is always the first argument. That is
what makes chaining work:

```ts
subject.apply("fn", ...rest)   ≡   fn(subject, ...rest)
```

```ts
const p = new Producer();
p.def("upper",  s => s.toUpperCase());
p.def("length", s => String(s.length));

p.value("paris").apply("upper");            // ["upper","paris","PARIS"]
p.value("paris").apply("upper").apply("length");   // chains through the answer
p.write();
```

That is the whole producer API: `def`, `value`, `apply`, `write`. There is
nothing here for asking questions, because a producer never reads. Walking is a
reader's job — the viewer, or `walk-cli.js`.

## The corpus

`scenarios/combined.ts` is the whole thing: **82 functions, 420 atoms, expanding
to 709 nodes and 1440 edges**, in 18KB of text. It was twelve separate scenario
files until 2026-09-05; folding them into one is the point, because everything
lands in ONE graph and values that different sources happen to agree on become
one node.

Some of the collisions the folding produced:

- `192.168.1.3` is a raw IP in one section; it is also what another digs out of
  `IP:192.168.1.3/24` by hand, and what the record shapes dig out of the same
  string. Three routes, one node.
- `3` is `lastOctet`, `lastOctetFromIP` and `octet4` — three functions, one
  answer — and also `length("cat")` and a timesheet `seq`, which nobody arranged.
- `paris` is a word in two texts, a CSV column value, a bare field, a grouped
  field, a config value, a JSON key and a nested JSON key.
- `city` is a word in the prose **and** a column function from the headered CSV.
  One node, two lives: two `fn` arrows out to the calls where it was the
  function, five `arg1` arrows out to the calls where it was a word.

The sections still carry the old scenario names and its header says what each
one shows. A function name is global to a producer (`def` throws on a repeat), so
where two sections used one name for one thing it is defined once and both feed
it — which is where most of the intersections come from. Where they used one name
for two *different* things, one was renamed, marked `RENAMED`.

## The viewer

This is where walking backwards gets checked by eye. If a shape really can be
read back out, you can see it here without it having been stored.

The page subscribes to the pile and expands the atoms itself. Nothing sends it a
graph, and no nodes-and-edges file exists anywhere.

**Expansion is incremental, and needs no reconciliation.** `expand` reads only
the atom, so `expand(A ∪ {x}) = expand(A) ∪ expand({x})`: an arriving atom is
expanded on its own and what comes out is added. There is nothing to diff,
nothing to invalidate, and an atom arriving twice is free. A viewer that stored a
derived graph would need all of that machinery exactly here.

One consequence you will see: vis-network re-settles its physics on every
arrival, so the picture moves while a producer is running.

- Nodes are coloured value / function / call. Edges are drawn unlabelled —
  direction only — and a call's slots show in the detail pane when you click it.
- Click a node to light it and its neighbours. `multi-select` makes clicks
  accumulate; clicking a lit node again drops it; clicking empty space clears.
- The wheel does not zoom. Pan with the arrow keys, zoom with `[` and `]`.

### triples

What a node is, from the graph's own side: what produced it, where it was used,
and for a call, its inputs by slot and its one answer.

### walk

Builds a table. Pick a function; everything it ever produced becomes the rows.
Click a cell to see where it can go, and tick a step to add a column.

Two trees are in play, and this is the heart of the tab:

- the **column tree** is what you ticked. Rooted at the anchor, branching,
  function names only, no data, the same for every row. **This is a schema, and
  it lives in the viewer, never in the graph** — which is why ticking can never
  change a snapshot.
- the **value tree** is what one starting value finds walking that. It branches
  wherever a step finds more than one answer, and its leaves are the rows.

A column header reads destination-first and spells out the way back —
`date() via rev_emp()` — so two columns that branched from the same point share a
suffix and the header says where they pair. A bare `fn()` goes to what a call
produced; `rev_fn()` goes to what it consumed, **the subject only**. Extra
arguments are part of a call's identity, not a place you can walk to.

```sh
npx tsx walk-cli.ts combined emp rev_emp date +hours
```

```
emp() | rev_emp()                    | date() via rev_emp()                    | hours() via rev_emp()
------+------------------------------+-----------------------------------------+-------------------------------
alice | "alice|2026-08-25|projX|5|2" | "alice|2026-08-25|projX|5|2".2026-08-25 | "alice|2026-08-25|projX|5|2".5
bob   | "bob|2026-08-25|projX|6|4"   | "bob|2026-08-25|projX|6|4".2026-08-25   | "bob|2026-08-25|projX|6|4".6
bob   | "bob|2026-08-25|projX|8|1"   | "bob|2026-08-25|projX|8|1".2026-08-25   | "bob|2026-08-25|projX|8|1".8
bob   | "bob|2026-08-26|projX|4|3"   | "bob|2026-08-26|projX|4|3".2026-08-26   | "bob|2026-08-26|projX|4|3".4
carol | "carol|2026-08-27|projX|8"   | "carol|2026-08-27|projX|8".2026-08-27   | "carol|2026-08-27|projX|8".8
carol | "carol|2026-08-27|projY|7"   | "carol|2026-08-27|projY|7".2026-08-27   | "carol|2026-08-27|projY|7".7
carol | "carol|2026-08-27|projY|8"   | "carol|2026-08-27|projY|8".2026-08-27   | "carol|2026-08-27|projY|8".8
```

Three `carol` rows for one person edited twice: the edit chain kept every
version, and which one is current is a question you ask, not a cell that was
overwritten.

Things the table does on purpose:

- **Values pair at their deepest shared step.** `date()` and `hours()` both hang
  off `rev_emp()`, so they pair at the record reached through it. Computing each
  branch independently would give a cross product — six wrong rows for bob
  instead of three right ones — so the walk carries its intermediate values
  rather than collapsing each branch to a set of leaves.
- **Identical values do not collapse.** Bob has three rows, two saying
  `2026-08-25`, because he has three records. The waypoint column beside them
  shows why they differ, which is why it defaults to visible.
- **A step that found nothing writes `?` and the row survives.** A row with a
  hole is more honest than a row that vanished.
- **Qualifiers** show the whole walk that produced a cell, and grow with depth.
- **Values are never shortened.** No nickname, no ellipsis, no
  hover-to-see-the-rest. The trap is not the ellipsis, it is what it grows into:
  the moment something is abbreviated you want a stable handle for the
  abbreviation, and that handle is an invented identifier wearing a hat. Quoting
  is not shortening.
- **Loops are allowed.** A word's siblings include the word itself, which is true
  and worth seeing. The depth budget ends every walk, so no cycle detection is
  needed.

A saved tick-set names **columns by their header** — the chain of function names
— and never a value, because naming a value welds a rendering choice in
permanently. A schema of function names travels: it means the same thing on any
graph built from the same functions. Wiping schema out of the data was never
about disliking schemas, it was about *when* they get committed to. At write time
a schema is a decision made before you know what you have, and changing it costs
a migration. At view time it is a hypothesis — hold several at once, including
contradictory ones, and throw them away for nothing.

Row count is therefore a property of the schema you ticked, not of the data. A
row is not a stable thing you can point at across two tick-sets.

## Checking that nothing changed

```sh
./runAll.sh          # run, write snapshots/combined.atoms
git diff snapshots/  # did anything move?
```

The snapshot is the regression artifact, and deterministic: atoms are written
sorted, so a diff line means the atoms changed, not that a call moved. It is the
same shape the pile holds, so `curl -X POST --data-binary @snapshots/combined.atoms
localhost:8000/atoms` puts it back in front of you. Stdout is otherwise
discarded. The graph does not narrate; the picture is the report.

## Files

```
producer.ts           runs functions, records atoms, sends or writes them
shapes.ts             records, sequences, edit chains — all write-only
scenarios/combined.ts a producer in TypeScript: every shape, in one
producers/atom.sh     a producer: one call as arguments, one line out
producers/repo.sh     a producer in bash, written by hand
producers/timesheet/  a producer in C#: ordinary code, logging to atoms
pile.js               the pile: takes atoms, streams them, serves the page
expand.js             atoms -> nodes and edges. The one expansion
walk.js               atoms -> tables. Browser and node, same file
viewer.ts             the viewer's behaviour
graph.html            the page: markup and styles
walk-cli.js           the walk tab without the tab
snapshots/            the regression artifact
run.sh                produce -> the pile
runAll.sh             produce -> snapshots/combined.atoms
log.md                things tried and set down again
```

`pile.atoms` is what the pile holds and is not tracked. `log.md` carries no
verdict: being in it means the thing was looked at and put aside for now, and any
entry may be picked back up.

## Known limits

**Asking twice leaves no mark.** The node is already there, the arrows are
already there, so two people asking for two different reasons are
indistinguishable afterwards. The graph holds the set of different questions,
with no count, no order, and no record of who asked. What that loses is the
evidence — who asked, from where, believing what — you would need to tell apart
two meanings of the same word.

That is also precisely what makes a thousand piles merge without coordination.
Counts would have to sum, order would conflict, timestamps would need reconciling
clocks. None of it exists, so union is the entire merge algorithm. Not a defect
waiting to be fixed — the price already paid, and this is what it bought. Which
constrains any fix: if who-asked is ever recorded it has to arrive as more atoms,
the asker as a value and the asking as a call, never as a field on the side.
Written that way two askers make two different calls and merging stays a union.

**A hole means two things.** A `?` in a table covers both "nobody made that call"
and "the call was made and came back empty", because a function that declines
writes nothing. Treating functions as types is what makes this matter: a type
that only knows its positives cannot answer "no".

**Nothing checks for conflicts.** Two producers could write the same call with
two different answers. We assume they never will, know that is not true in
general, and parked it deliberately. Nothing is enforced, so the honest thing is
also the default: the call gets two arrows out and the picture shows a fork. Name
prefixes per producer were considered and set aside — see `log.md`.

**One vocabulary per producer, and no further.** `def` throws on a repeated
function name, but only within one producer. Across a pile there is no shared
table, no registry, and no check available even in principle, because the pile
has no vocabulary and never runs a function.

This is demonstrated rather than argued. `scenarios/combined.ts` reads a CSV
headed `first,last` and mints a function per column, so its `first` means "the
first comma-separated field of a row". `producers/repo.sh` uses `first` to mean
"the first part of a `|`-separated list". Both are sent to the same pile, and the
graph gets one `first` node with five calls hanging off it:

```
first -fn-> first(carol,white)        the CSV column
first -fn-> first(dave,green)
first -fn-> first(paris|is|a|city)    the list head
first -fn-> first(the|city|is|old)
first -fn-> first(tokyo|is|a|city)
```

Nothing is corrupted and no answer is wrong. The word is doing two jobs, the
picture is the only place it shows, and a reader who anchors on `first` gets
both. That is the accepted cost of anyone bringing their own vocabulary, and it
is what a second producer was needed to make visible.

## Not built yet

- **A merge harness.** Streaming already expands the corpus 420 groups of one,
  in run order rather than sorted order, and gets the same picture — grouping-
  and order-independence at the limit. What is left to check is splitting a file
  any number of ways, and many random orderings rather than the two that arise
  naturally.
- **A graph server.** `pile.js` holds the pile and answers no questions —
  `expand` and `walk` are the reader's, and it never runs a function. A server
  that gets *asked things* is a different thing, and nothing is built across that
  line.
- **A crawler that hunts containment** — noticing that `smith` sits inside
  `smith@example.com`. One ordinary function whose two arguments are drawn
  from the graph's own values, applied by something that walks on its own.
  Deliberately optional, opt-in, and named in the graph where it can be switched
  off — one activity among many rather than the core one.
- **Weights on ticks.** Booleans today; wherever a schema is stored should not
  assume that.
- **Time and ordering.** The one that touches the claim itself: it is what *Known
  limits* is missing, so whatever gets built there changes the claim and not just
  the code.

Nothing ranks anything, and nothing prefers a shorter path. Ticks replace a cost
function. Walks are few, so all of them can be shown and length is at most a sort
order.
