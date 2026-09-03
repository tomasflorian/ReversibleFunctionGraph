#!/usr/bin/env bash
# show.sh <scenario> — run a scenario (regenerating data.js) then open the viewer.
# Works from anywhere: runs from the project directory so relative imports resolve.
#
#   ./show.sh path      # names / CSV / endpoints
#   ./show.sh hubs      # many functions over few values
#
# With no argument (or an unknown one), lists the available scenarios.
# If a graph.html tab is already open, reload it after the run instead.
set -e

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"

list() {
  echo "scenarios:"
  for f in "$here"/scenarios/*.ts; do
    [ -e "$f" ] || continue
    echo "  - $(basename "$f" .ts)"
  done
}

name="${1:-}"
rel="scenarios/$name.ts"

if [ -z "$name" ] || [ ! -f "$here/$rel" ]; then
  [ -n "$name" ] && echo "unknown scenario: $name" >&2
  echo "usage: $(basename "$0") <scenario>" >&2
  list >&2
  exit 1
fi

npx tsx "$rel"
xdg-open "$here/graph.html"
