#!/usr/bin/env bash
# run.sh — run the producer and send its atoms to the pile.
#
#   npm start      # in one terminal: the pile, at http://localhost:8000
#   ./run.sh       # in another: produce, and watch the picture fill in
#
# The pile keeps what it is given, so running this twice adds nothing the second
# time — merging is idempotent, and re-sending everything is free by design.
# Point somewhere else with RFG_PILE.
set -e
cd "$(cd "$(dirname "$0")" && pwd)"
npx tsx scenarios/combined.ts
