#!/usr/bin/env bash
# runAll.sh — run every scenario and write its graph to snapshots/<name>.js.
#
#   ./runAll.sh
#   git diff snapshots/          # did anything move?
#
# The snapshots are the regression artifact. They are DETERMINISTIC: nodes and
# edges are written in canonical (sorted) order, so a diff line means the graph
# actually changed, not that a call moved. Refactor freely, re-run this, and the
# diff shows what shifted under you.
#
# Each snapshot is also directly viewable — it is the same window.GRAPH format
# data.js uses:
#
#   cp snapshots/text.js data.js && xdg-open graph.html
#
# Scenario stdout is discarded. The scenarios build a graph and render it; they
# do not narrate. The picture is the report.

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"

OUT="snapshots"
mkdir -p "$OUT"

fail=0

snap() {
  local name="$1" file="$2"
  # The REPLs are fed "quit" so they seed their graph and exit.
  if ! printf 'quit\n' | RFG_OUT="$OUT/$name.js" npx tsx "$file" >/dev/null 2>&1; then
    echo "  [$name exited non-zero]" >&2
    fail=1
  fi
}

for f in scenarios/*.ts anti-scenarios/*.ts; do
  [ -e "$f" ] || continue
  snap "$(basename "$f" .ts)" "$f"
done

ls "$OUT" | sed 's/^/  /'
echo "wrote $(ls "$OUT" | wc -l) snapshot(s) to $OUT/"
exit $fail
