#!/usr/bin/env bash
# runAll.sh — run every scenario + general non-interactively and capture all
# their output into dataAll.log. The log is DETERMINISTIC (no timestamps, no
# randomness), so it is a diffable snapshot: refactor freely, re-run this, and
# `git diff dataAll.log` shows whether any behaviour actually changed.
#
#   ./runAll.sh
#
# (The interactive CLIs are fed a fixed command script so their output is stable.)

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"

LOG="dataAll.log"
: > "$LOG"

banner() {
  {
    echo
    echo "════════════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "════════════════════════════════════════════════════════════════════════"
    echo
  } >> "$LOG"
}

# ---- batch scenarios (print and exit) --------------------------------------
for s in basic dense flat types path text text-index timesheet general-demo; do
  banner "scenario: $s"
  npx tsx "scenarios/$s.ts" >> "$LOG" 2>&1 \
    || echo "  [exited non-zero]" >> "$LOG"
done

# ---- interactive CLIs (fed a fixed command script) -------------------------
run_cli() {
  local title="$1" file="$2" script="$3"
  banner "$title"
  printf '── input ──\n%s\n\n── output ──\n' "$script" >> "$LOG"
  printf '%s\n' "$script" | npx tsx "$file" >> "$LOG" 2>&1 \
    || echo "  [exited non-zero]" >> "$LOG"
}

run_cli "general (scripted)" "general.ts" \
"tables
sources
drop 0
tables
quit"

run_cli "timesheet-cli (scripted)" "scenarios/timesheet-cli.ts" \
"list
view
log
quit"

echo "wrote $LOG"
