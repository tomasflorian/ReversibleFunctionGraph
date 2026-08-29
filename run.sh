#!/usr/bin/env bash
# run.sh — run the RFG2 demo. Works from anywhere: runs from the repo root so
# the relative imports in play.ts / graph.ts resolve.
#
#   ./ReversibleFunctionGraph2/run.sh
set -e

here="$(cd "$(dirname "$0")" && pwd)" # ReversibleFunctionGraph2/
root="$(dirname "$here")"             # repo root (parent of this folder)
cd "$root"

npx tsx ReversibleFunctionGraph2/play.ts
