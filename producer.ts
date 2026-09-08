// producer.ts — runs functions and writes down what happened.
//
// One call in, one atom out:
//
//   p.value("cat").apply("length")   ->   ["length","cat","3"]
//
// That is the whole of it. There is no graph in this file and there are no
// nodes: a Value is a handle on a string, so that `subject.apply(fn, ...rest)`
// reads as `fn(subject, ...rest)` and chains. A graph is what somebody else
// makes of these lines later — expand.js turns them into nodes and edges for the
// picture, walk.js indexes them into tables — and neither is this file's
// business. See the README.
//
// A producer never reads the pile. It knows the answer it just computed and the
// answers it computed earlier in this same run, and nothing else. Its insides
// can be as complicated as they like; what leaves it is lines of text. Two
// producers never coordinate, because merging their output is concatenating it.

import { writeFileSync } from "node:fs";

export const NOTHING = "∅";
export type Fn = (...args: string[]) => string | null;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const defaultOut = (): string | URL =>
  process.env.RFG_OUT ?? new URL("./atoms.txt", import.meta.url);

export class Value {
  readonly value: string;
  private producer: Producer;

  constructor(value: string, producer: Producer) {
    this.value = value;
    this.producer = producer;
  }

  apply(fn: string, ...rest: string[]): Value {
    // One failed step carries through a chain, so no function has to check for
    // it. NOTHING is never a value, never an atom, and never reaches the file.
    if (this.value === NOTHING) return this.producer.value(NOTHING);
    return this.producer.apply(fn, this.value, ...rest);
  }

  toString(): string { return this.value; }
}

export class Producer {
  private fns = new Map<string, Fn>();
  private acts: string[][] = [];
  private answers = new Map<string, string>();

  // GUARD — a function name is defined once. A name is this producer's
  // vocabulary, so defining one twice means one word with two meanings, and it
  // would fail quietly: calls already made keep the answer they have while only
  // new ones get the new behaviour.
  //
  // The two guards that used to sit beside this one are gone, and neither was
  // lost. "A node is a value or a call, never both" is now true by construction
  // — a value is identified by its text and a call by its argument list, which
  // are different things — and expand.js says so out loud on the one pathological
  // case. "Every arrow crosses between a value and a call" cannot be violated
  // either, because arrows are not drawn any more; they are derived, and the
  // derivation only ever produces value -> call -> value.
  def(name: string, impl: Fn): void {
    if (this.fns.has(name)) throw new Error(`"${name}" is already defined`);
    this.fns.set(name, impl);
  }

  value(text: string): Value { return new Value(text, this); }

  apply(fn: string, ...args: string[]): Value {
    // The memo keys on the call's IDENTITY — the function and its arguments,
    // kept apart — so two different calls can never share an answer. The old
    // version keyed on the arguments joined with commas, which meant
    // join2("a,b","c") and join2("a","b,c") were one key.
    //
    // It only saves work. Delete it and, as long as functions return the same
    // answer for the same arguments, the atoms come out the same except for
    // repeats — and a repeated atom changes no graph, because merging is
    // idempotent.
    const key = JSON.stringify([fn, ...args]);
    const known = this.answers.get(key);
    if (known !== undefined) return this.value(known);

    const raw = this.run(fn, args);

    // A function that returns null writes NOTHING DOWN. The graph never learns
    // the question was asked. A null is a fact about a question rather than
    // about the world, and the set of questions a function declines is unbounded
    // — most strings are not an IP — so recording them grows the file with what
    // was asked instead of with what was found.
    if (raw === null) return this.value(NOTHING);

    this.answers.set(key, raw);
    this.acts.push([fn, ...args, raw]);
    return this.value(raw);
  }

  run(fn: string, args: string[]): string | null {
    const impl = this.fns.get(fn);
    if (!impl) throw new Error(`no function named "${fn}"`);
    return impl(...args);
  }

  // Appended as calls happen, so this is in the order they ran. That order
  // carries no meaning — a graph is a function of the SET of atoms — so write()
  // sorts, and a diff line then means the atoms actually changed.
  atoms(): string[][] { return this.acts.map(a => [...a]); }

  // One atom per line, and nothing else. NOT nodes and edges: a graph is
  // derived, not stored, and the derived form is the one that loses things
  // (argument order, a repeated argument) rather than the atoms.
  //
  // Sorted, because this is the regression artifact and a diff line should mean
  // the atoms changed rather than that a call moved.
  write(path: string | URL = defaultOut()): void {
    const lines = this.acts.map(a => JSON.stringify(a)).sort(cmp);
    writeFileSync(path, lines.join("\n") + "\n");
    console.log(`wrote ${lines.length} atoms -> ${path instanceof URL ? "atoms.txt" : path}`);
  }

  // The same lines, posted to a pile instead of written to a file. Unsorted,
  // because they go in the order they happened and order carries no meaning.
  //
  // Nothing comes back but a count. A producer does not read, does not ask what
  // is already there, and does not care whether it is the first to arrive or the
  // thousandth — re-sending everything and sending only what is new have the
  // same effect, because merging is idempotent.
  async send(url: string = process.env.RFG_PILE ?? "http://localhost:8000/atoms"): Promise<void> {
    const lines = this.acts.map(a => JSON.stringify(a));
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: lines.join("\n") + "\n",
    });
    if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
    const added = (await res.text()).trim();
    console.log(`sent ${lines.length} atoms -> ${url} (${added} new)`);
  }
}
