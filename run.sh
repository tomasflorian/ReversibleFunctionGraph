#!/usr/bin/env bash
# run.sh <scenario> — run a scenario, regenerating data.js (no viewer).
# Works from anywhere: runs from the project directory so relative imports resolve.
#
#   ./run.sh path
#
# With no argument (or an unknown one), lists the available scenarios.
set -e

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"

name="${1:-}"
rel="scenarios/$name.ts"
[ -f "$here/$rel" ] || rel="anti-scenarios/$name.ts"

if [ -z "$name" ] || [ ! -f "$here/$rel" ]; then
  [ -n "$name" ] && echo "unknown scenario: $name" >&2
  echo "usage: $(basename "$0") <scenario>" >&2
  echo "scenarios:" >&2
  for f in "$here"/scenarios/*.ts; do [ -e "$f" ] || continue; echo "  - $(basename "$f" .ts)" >&2; done
  echo "anti-scenarios (they work; they are not how to do it):" >&2
  for f in "$here"/anti-scenarios/*.ts; do [ -e "$f" ] || continue; echo "  - $(basename "$f" .ts)" >&2; done
  exit 1
fi

npx tsx "$rel"
