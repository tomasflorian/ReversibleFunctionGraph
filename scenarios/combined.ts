// combined.ts — the graph. Every shape the project has, in one place.
//
// This was twelve separate scenarios until 2026-09-05, each keeping to one shape
// so that shape could be seen clearly. They are folded in here, and the folding
// is the point: everything lands in ONE graph, so values that different sources
// happen to agree on become one node, and a value can be reached by routes that
// have nothing to do with each other. The sections below still carry the old
// names, because they are still the useful way to say which shape is which.
//
// Some of the collisions are pretty:
//
//   192.168.1.3   is the raw IP of the `flat` section; it is also what `hubs`
//                 digs out of "IP:192.168.1.3/24" by hand, and what the record
//                 shapes dig out of the same string. Three routes, one node.
//   "3"           is lastOctet, lastOctetFromIP and octet4 — three functions,
//                 one answer — and also length("cat") and a timesheet seq, which
//                 nobody arranged.
//   paris         is a word in both texts, a CSV column value, a bare field, a
//                 grouped field, a config value, a JSON key and a nested JSON
//                 key. Eight functions land on it.
//   the city text is cut twice at once — by the sequences, and by the indexed
//                 functions that were the anti-scenario. Same words, two ways,
//                 side by side, with nothing labelling which is preferred.
//
// A function name is global (`def` throws on a repeat), so where two sections
// used one name for one thing it is defined once and both feed it — that is
// where most of the intersections come from. Where they used one name for two
// DIFFERENT things, one had to be renamed, and each rename is marked RENAMED.
//
// Isolation did not disappear with the separate files: anchoring the walk tab on
// `emp()` is choosing the timesheet part. You select a view instead of running a
// file.

import { Producer } from "../producer.js";
import { shapes } from "../shapes.js";


const p = new Producer();
const { record, sequence, versioned } = shapes(p);

// ---------------------------------------------------------------------------
// basic + hubs — the battery of small string functions.
//
// basic and hubs both define length and upper; defined once, applied to both
// sets of words. basic's firstLetter and hubs' first are the same operation
// under two names, so firstLetter wins and hubs' first/last become
// firstLetter/lastLetter — RENAMED, because path needs `first` and `last` for
// its CSV columns and those are a different thing entirely.

p.def("length",      s => String(s.length));
p.def("upper",       s => s.toUpperCase());
p.def("firstLetter", s => s.charAt(0));
p.def("lastLetter",  s => s.charAt(s.length - 1));
p.def("reverse",     s => s.split("").reverse().join(""));
p.def("sort",        s => s.split("").sort().join(""));
p.def("vowels",      s => String((s.match(/[aeiou]/g) ?? []).length));
p.def("hasLetter",   (s, c) => String(s.includes(c)));

// basic's `cut` was a plain function returning "p|a|r|i|s"; here it is a
// sequence, so the characters are nodes too and meet firstLetter's answers.
const Chars = sequence("cutChars", "char", s => s.split(""));

const battery = ["length", "upper", "reverse", "firstLetter", "lastLetter", "sort", "vowels"];
const anagrams = ["cat", "act", "arc", "car", "tar", "rat", "art"];
const short    = ["lima", "bat", "paris", "tokyo"];

for (const w of [...anagrams, ...short]) {
  for (const fn of battery) p.value(w).apply(fn);
  Chars.of(w);
}
for (const w of anagrams) {
  for (const c of ["a", "c", "r", "t", "z"]) p.value(w).apply("hasLetter", c);
  p.value(w).apply("reverse").apply("sort");
  p.value(w).apply("upper").apply("length");
}

// ---------------------------------------------------------------------------
// text + general-demo prose — one set of cutters, two texts.
//
// text and general-demo both cut paragraphs, sentences and words the same way,
// so there is one set of sequences and both texts go through it. basic's
// cutWords is the same function again — "paris france" is cut by the same
// `word` that cuts the sentences.

const Paragraphs = sequence("cutParagraphs", "paragraph", t => t.split("\n\n"));
const Sentences  = sequence("cutSentences",  "sentence",  t => t.split("\n"));
const Words      = sequence("cutWords",      "word",      s => s.split(" "));

const cityText =
`paris is a city
the city is old

tokyo is a city
the city is new

a city is a place`;

const prose =
`paris sits on the seine
tokyo sits on the sumida

a city is a place`;

for (const text of [cityText, prose])
  for (const para of Paragraphs.of(text))
    for (const s of Sentences.of(para.value))
      Words.of(s.value);

Words.of("paris france");

// ---------------------------------------------------------------------------
// text-index (anti-scenario) — the same text, cut by index instead.
//
// RENAMED: paragraph/sentence/word are taken by the sequences above, so the
// indexed versions are paragraphAt/sentenceAt/wordAt. They run over the SAME
// text, so both ways of cutting land on the same word nodes — which is the
// clearest look at why one is the scenario and the other is the anti-scenario.

p.def("paragraphAt", (t, i) => t.split("\n\n")[+i] ?? null);
p.def("sentenceAt",  (p, i) => p.split("\n")[+i]   ?? null);
p.def("wordAt",      (s, i) => s.split(" ")[+i]    ?? null);

for (let pi = 0; pi < 3; pi++) {
  const para = p.value(cityText).apply("paragraphAt", String(pi));
  if (para.value === "∅") continue;
  for (let si = 0; si < 2; si++) {
    const sent = para.apply("sentenceAt", String(si));
    if (sent.value === "∅") continue;
    for (let wi = 0; wi < 5; wi++) sent.apply("wordAt", String(wi));
  }
}

// ---------------------------------------------------------------------------
// types — predicates. A function is what a type used to be.

p.def("isString", s => s);
p.def("isNumber", s => /^\d+$/.test(s) ? s : null);
p.def("isPort",   s => /^\d+$/.test(s) && +s <= 65535 ? s : null);
p.def("isIP",     s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split(".").every(o => +o <= 255) ? s : null);
p.def("isInternalIP", s => {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return null;
  const [a, b] = s.split(".").map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ? s : null;
});
p.def("isHost", s =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(s) ? s
    : (/^[a-z0-9]+(\.[a-z0-9]+)+$/i.test(s) && /[a-z]/i.test(s) ? s : null));
p.def("isEmail", s => s.includes("@") ? s : null);

const predicates = ["isString", "isNumber", "isPort", "isIP", "isInternalIP", "isHost", "isEmail"];
const tested = [
  "192.168.1.2", "8.8.8.8", "db01.internal", "user@db.local", "8080",
  "hello world", "mystery-blob",
  "192.168.1.3",  // flat's IP and hubs' IP — the predicates meet them here
  "10.0.0.5",
];
for (const v of tested) for (const pred of predicates) p.value(v).apply(pred);

// ---------------------------------------------------------------------------
// flat — a chain: is it an IP, and if so what is its last octet.

p.def("isValidIP", s =>
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split(".").every(o => +o <= 255)
    ? s : null);
p.def("lastOctet", s => s.split(".")[3]);
p.def("octetSum",  s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s)
  ? String(s.split(".").reduce((a, o) => a + +o, 0)) : null);

p.value("192.168.1.3").apply("isValidIP").apply("lastOctet");
p.value("fifskje").apply("isValidIP").apply("lastOctet");   // stops at ∅, as it should
p.value("10.0.0.5").apply("octetSum");
p.value("192.168.1.3").apply("octetSum");

// ---------------------------------------------------------------------------
// hubs — the same "IP:192.168.1.3/24" taken apart by hand-written parsers.

p.def("parseRecordType",            s => s.split(":")[0]);
p.def("parseRecordValue",           s => s.split(":")[1]);
p.def("parseIPFromIPWithSubnet",    s => s.split("/")[0]);
p.def("parseSubnetFromIPWithSubnet", s => s.split("/")[1]);
p.def("lastOctetFromIP",            s => s.split(".")[3]);

const raw = "IP:192.168.1.3/24";
p.value(raw).apply("parseRecordType");
p.value(raw).apply("parseRecordValue").apply("parseIPFromIPWithSubnet").apply("lastOctetFromIP");
p.value(raw).apply("parseRecordValue").apply("parseSubnetFromIPWithSubnet");

// ---------------------------------------------------------------------------
// hubs-record — the SAME string again, taken apart by record shapes instead.
//
// RENAMED: the "/" record's fields were ip and subnet; ip is needed below for
// path's endpoints, which split on ":" and mean something else. They are
// cidrIP and cidrMask here.
//
// This section adds almost no new values — it arrives at 192.168.1.3 and at "3"
// where hubs already is. Two ways of writing the same parse, meeting on the
// answer.

record(":", ["recordType", "recordValue"]);
record("/", ["cidrIP", "cidrMask"]);
record(".", ["octet1", "octet2", "octet3", "octet4"]);

p.value(raw).apply("recordType");
p.value(raw).apply("recordValue").apply("cidrIP").apply("octet4");
p.value(raw).apply("recordValue").apply("cidrMask");

// ---------------------------------------------------------------------------
// path — names two ways round, a CSV with a header, and endpoints.

p.def("firstName", s => (s.includes(",") ? s.split(", ")[1] : s.split(" ")[0]));
p.def("lastName",  s => (s.includes(",") ? s.split(", ")[0] : s.split(" ")[1]));
for (const nm of ["robert smith", "smith, robert", "alice brown", "brown, alice"]) {
  p.value(nm).apply("firstName");
  p.value(nm).apply("lastName");
}

p.def("headerLine", c => c.split("\n")[0]);
const Rows = sequence("cutRows", "row", c => c.split("\n").slice(1));

const csv = "first,last\ncarol,white\ndave,green";
const cols = p.value(csv).apply("headerLine").value.split(",");
cols.forEach((name, i) => p.def(name, r => r.split(",")[i] ?? null));
for (const r of Rows.of(csv)) for (const name of cols) r.apply(name);

p.def("ip",   s => s.split(":")[0]);
p.def("port", s => s.split(":")[1]);
for (const ep of ["192.168.1.10:8080", "192.168.1.10:443", "10.0.0.5:22"]) {
  p.value(ep).apply("ip");
  p.value(ep).apply("port");
}

// ---------------------------------------------------------------------------
// timesheet + timesheet-cli — one record shape for both.
//
// timesheet's rows carry a seq field and the CLI's do not. One five-field record
// serves both: on a four-field row, seq simply finds nothing. The date record
// carries a guard so `year` does not try itself on "mystery-blob".

const Entry = record("|", ["emp", "date", "proj", "hours", "seq"]);
const Day   = record("-", ["year", "month", "day"], d => /^\d{4}-\d{2}-\d{2}$/.test(d));
const edit  = versioned("edit");

const timesheet = [
  "bob|2026-08-25|projX|8|1",
  "alice|2026-08-25|projX|5|2",
  "bob|2026-08-26|projX|4|3",
  "bob|2026-08-25|projX|6|4",
  "carol|2026-08-27|projY|7",   // the CLI's four-field shape — no seq
];
for (const rec of timesheet) {
  Entry.of(rec);
  Day.of(Entry.read(rec, "date"));
}

// the CLI's edit chain: a row corrected twice, both versions kept
edit.apply("carol|2026-08-27|projY|7", "carol|2026-08-27|projY|8");
edit.apply("carol|2026-08-27|projY|8", "carol|2026-08-27|projX|8");
for (const rec of ["carol|2026-08-27|projY|8", "carol|2026-08-27|projX|8"]) {
  Entry.of(rec);
  Day.of(Entry.read(rec, "date"));
}

// ---------------------------------------------------------------------------
// general-demo — six ways of writing the same two cities down.
//
// Its prose went through the sequences above. What is left is the other five
// formats, each with its own cutters, all arriving at paris and tokyo.

p.def("hasFormat", (_raw, name) => name);
const tag = (text: string, format: string) => p.value(text).apply("hasFormat", format);

tag(cityText, "prose");
tag(prose, "prose");

const headered = `city,country
paris,france
tokyo,japan`;
const Place = record(",", headered.split("\n")[0].split(","));
tag(headered, "headered-csv");
for (const r of Rows.of(headered)) Place.of(r.value);

const bare = `paris,france,europe
tokyo,japan,asia`;
const Lines  = sequence("cutLines",  "line",  c => c.split("\n"));
const Fields = sequence("cutFields", "field", l => l.split(","));
tag(bare, "bare-csv");
for (const l of Lines.of(bare)) Fields.of(l.value);

const grouped = `paris:2.35,48.85
tokyo:139.69,35.68`;
const GroupedLines  = sequence("cutGroupedLines",  "groupedLine",  c => c.split("\n"));
const GroupedFields = sequence("cutGroupedFields", "groupedField", l => l.split(":"));
tag(grouped, "grouped");
for (const l of GroupedLines.of(grouped)) GroupedFields.of(l.value);

const json = `[{"place":"paris","river":"seine"},{"place":"tokyo","river":"sumida"}]`;
const Items = sequence("cutItems", "item", j => JSON.parse(j).map((o: unknown) => JSON.stringify(o)));
tag(json, "json");
const items = Items.of(json);
for (const key of ["place", "river"])
  p.def(key, s => (JSON.parse(s) as Record<string, string>)[key] ?? null);
for (const item of items) for (const key of ["place", "river"]) item.apply(key);

const config = `name: paris
nation: france

name: tokyo
nation: japan`;
const Blocks = sequence("cutBlocks", "block", t => t.split("\n\n"));
const Pairs  = sequence("cutPairs",  "pair",  b => b.split("\n"));
tag(config, "key-value");
const pairs = Blocks.of(config).flatMap(b => Pairs.of(b.value));
for (const key of ["name", "nation"]) p.def(key, s => s.split(": ")[1] ?? null);
for (const pair of pairs) pair.apply(pair.value.split(": ")[0]);

// ---------------------------------------------------------------------------
// general (anti-scenario) — a function minted per JSON key, walking down into
// nested objects.
//
// RENAMED throughout: its keys were first/last/ip/geo/city/country, all of which
// name something else here. The shape is what matters — the loader does not know
// the keys ahead of time, it defines a function as it meets one. The address it
// carries is 10.0.0.5, which flat has already summed and path has already seen
// as an endpoint.

const nested = { addr: "10.0.0.5", geo: { town: "paris", region: "idf" } };

function chopObject(obj: Record<string, unknown>, seen: Set<string>): void {
  const s = JSON.stringify(obj);
  for (const key of Object.keys(obj)) {
    if (!seen.has(key)) {
      seen.add(key);
      p.def(key, (str: string) => {
        const v = (JSON.parse(str) as Record<string, unknown>)[key];
        return v === undefined || v === null ? null
          : typeof v === "object" ? JSON.stringify(v) : String(v);
      });
    }
    p.value(s).apply(key);
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val))
      chopObject(val as Record<string, unknown>, seen);
  }
}
chopObject(nested, new Set());

// Write a file, or send to a pile. RFG_OUT names a file — that is runAll.sh,
// building the regression artifact without needing anything running. With no
// RFG_OUT the atoms go to the pile at RFG_PILE (localhost:8000 by default), and
// whoever is watching sees the picture fill in as they arrive.
if (process.env.RFG_OUT) p.write();
else p.send().catch((e: unknown) => { console.error(String(e)); process.exit(1); });
