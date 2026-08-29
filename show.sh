#!/usr/bin/env bash
# show.sh — build the graph (play.ts, which regenerates data.js) then open the
# viewer. Works from anywhere: it runs from the repo root so the relative paths
# in play.ts / viz.ts resolve.
#
#   ./ReversibleFunctionGraph2/show.sh
#
# If a graph.html tab is already open, you can just reload it instead of re-running.
set -e

here="$(cd "$(dirname "$0")" && pwd)" # ReversibleFunctionGraph2/
root="$(dirname "$here")"             # repo root (parent of this folder)
cd "$root"

npx tsx ReversibleFunctionGraph2/play-dense.ts
xdg-open ReversibleFunctionGraph2/graph.html
