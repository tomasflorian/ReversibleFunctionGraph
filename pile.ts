#!/usr/bin/env node
// pile.ts — the pile. Producers write to it, readers read from it.
//
//   npm start                    # http://localhost:8000
//   PORT=9000 npx tsx pile.ts
//
//   POST   /atoms   append. Body is atom lines, exactly as the file holds them.
//   GET    /atoms   text/event-stream. Replays the whole pile, then stays open
//                   and streams every atom as it arrives.
//   DELETE /atoms   empty it. An operator action, never a producer's.
//   GET    /*       graph.html and the static files beside it.
//
// The pile has NO VOCABULARY. It never runs a function and may not even have
// the function, so it cannot check that an answer is right — only that a line
// is shaped like an atom. It does not expand, does not index, and answers no
// questions. Everything a reader wants, a reader derives.
//
// Two things it does do, both housekeeping rather than meaning:
//
//   - it drops a line it already holds, byte for byte. Merging is idempotent,
//     so a producer re-sending its whole output is free and is meant to be. This
//     only stops the file growing with repeats. It is textual, not semantic: two
//     atoms with the same call and DIFFERENT answers are a conflict, and both
//     are kept, because nothing here is entitled to pick a winner.
//   - it keeps arrival order. Order carries no meaning — a graph is a function
//     of the SET of atoms — so there is nothing to sort. runAll.sh sorts when it
//     writes the regression artifact, which is the only place order matters, and
//     it matters there for diffs rather than for meaning.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFileSync, existsSync, readFile, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8000;
const FILE = process.env.RFG_PILE_FILE ?? join(ROOT, "pile.atoms");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".atoms": "text/plain; charset=utf-8",
};

// --- the pile ---------------------------------------------------------------

interface Reader { res: ServerResponse; n: number }

let lines: string[] = [];        // atom lines, in arrival order
const held = new Set<string>();  // the same lines, for the byte-for-byte drop
const readers: Reader[] = [];    // open event streams

function load(): void {
  if (!existsSync(FILE)) return;
  for (const l of readFileSync(FILE, "utf8").split("\n")) {
    const t = l.trim();
    if (t && !held.has(t)) { held.add(t); lines.push(t); }
  }
}

// Shape only: a JSON array of at least three strings. That is as far as the
// pile is allowed to look — anything more would be reading the atom.
function malformed(line: string): string | null {
  let a: unknown;
  try { a = JSON.parse(line); } catch { return "not JSON"; }
  if (!Array.isArray(a)) return "not an array";
  if (a.length < 3) return "fewer than three slots";
  if (!a.every((s: unknown) => typeof s === "string")) return "not all strings";
  return null;
}

function append(incoming: string[]): number {
  const fresh: string[] = [];
  for (const line of incoming) {
    if (held.has(line)) continue;
    held.add(line);
    lines.push(line);
    fresh.push(line);
  }
  if (fresh.length) {
    appendFileSync(FILE, fresh.join("\n") + "\n");
    for (const r of readers) { send(r.res, r.n, fresh); r.n += fresh.length; }
  }
  return fresh.length;
}

function send(res: ServerResponse, startId: number, batch: string[]): void {
  for (let i = 0; i < batch.length; i++)
    res.write(`id: ${startId + i}\ndata: ${batch[i]}\n\n`);
}

// --- http -------------------------------------------------------------------

function body(req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let b = "";
    req.on("data", (c: Buffer) => (b += c));
    req.on("end", () => resolve(b));
  });
}

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);

  if (url === "/atoms") {
    if (req.method === "POST") {
      const incoming = (await body(req)).split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of incoming) {
        const why = malformed(line);
        if (why) { res.writeHead(400).end(`not an atom (${why}): ${line}\n`); return; }
      }
      const added = append(incoming);
      console.log(`+${added} atom(s) (${incoming.length - added} already held) — ${lines.length} total`);
      res.writeHead(200, { "content-type": "text/plain" }).end(`${added}\n`);
      return;
    }

    if (req.method === "DELETE") {
      lines = []; held.clear();
      writeFileSync(FILE, "");
      for (const r of readers) { r.res.write("event: reset\ndata: \n\n"); r.n = 0; }
      console.log("pile emptied");
      res.writeHead(200, { "content-type": "text/plain" }).end("emptied\n");
      return;
    }

    // A reader subscribes. The whole pile is replayed first and the stream then
    // stays open, so there is no gap between "fetch what is there" and "hear
    // what arrives next" for an atom to fall into.
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "connection": "keep-alive",
    });
    const reader = { res, n: 0 };
    send(res, 0, lines);
    reader.n = lines.length;
    readers.push(reader);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ping);
      const i = readers.indexOf(reader);
      if (i >= 0) readers.splice(i, 1);
    });
    return;
  }

  const file = join(ROOT, url === "/" ? "/graph.html" : url);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end("outside the project"); return; }
  readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("no such file: " + url); return; }
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    }).end(data);
  });
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`something is already on port ${PORT}`);
    process.exit(1);
  }
  throw err;
});

load();
server.listen(PORT, () =>
  console.log(`pile: ${lines.length} atom(s) in ${FILE}\n` +
              `      http://localhost:${PORT}`));
