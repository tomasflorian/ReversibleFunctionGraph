import { Graph } from "../graph.ts";
import { shapes } from "../shapes.ts";
import { renderData } from "../view.ts";

const g = new Graph();

const Entry = shapes(g).record("|", ["emp", "date", "proj", "hours", "seq"]);

const log = [
  "bob|2026-08-25|projX|8|1",
  "alice|2026-08-25|projX|5|2",
  "bob|2026-08-26|projX|4|3",
  "bob|2026-08-25|projX|6|4",
];
for (const rec of log) Entry.of(rec);

renderData(g);
