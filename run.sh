#!/usr/bin/env bash
# run.sh <scenario> — run a scenario, regenerating data.js (no viewer).
# Works from anywhere: runs from the repo root so relative imports resolve.
#
#   ./ReversibleFunctionGraph2/run.sh path
#
# With no argument (or an unknown one), lists the available scenarios.
set -e

here="$(cd "$(dirname "$0")" && pwd)" # ReversibleFunctionGraph2/
root="$(dirname "$here")"             # repo root (parent of this folder)
cd "$root"

name="${1:-}"
rel="ReversibleFunctionGraph2/scenarios/$name.ts"

if [ -z "$name" ] || [ ! -f "$root/$rel" ]; then
  [ -n "$name" ] && echo "unknown scenario: $name" >&2
  echo "usage: $(basename "$0") <scenario>" >&2
  echo "scenarios:" >&2
  for f in "$here"/scenarios/*.ts; do [ -e "$f" ] || continue; echo "  - $(basename "$f" .ts)" >&2; done
  exit 1
fi

npx tsx "$rel"
