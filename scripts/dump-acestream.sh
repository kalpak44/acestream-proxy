#!/usr/bin/env bash
# Dump every page from the engine's /search endpoint into acestream-dump.json.
#
# Run this on the Docker host where the acestream stack is deployed. It uses
# `docker exec` on the playlist container (which sits inside the compose
# network and can reach engine:6878).
#
# Usage:
#   ./scripts/dump-acestream.sh [container] [search_url] [page_size] [out_file]
#
# Defaults:
#   container   = acestream-playlist
#   search_url  = http://engine:6878/search
#   page_size   = 50
#   out_file    = ./acestream-dump.json
#
# The resulting file is a JSON array — one element per raw AceStream `result`,
# merged across all pages. Feed it to scripts/diagnose-matching.js.

set -euo pipefail

CONTAINER="${1:-acestream-playlist}"
SEARCH_URL="${2:-http://engine:6878/search}"
PAGE_SIZE="${3:-50}"
OUT_FILE="${4:-./acestream-dump.json}"

if ! command -v docker >/dev/null; then
  echo "docker CLI is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "jq is required for merging pages" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

page=1
while true; do
  page_file="$TMP_DIR/page-$page.json"
  echo "Fetching page $page..." >&2
  docker exec "$CONTAINER" wget -q -O - "${SEARCH_URL}?page=${page}&page_size=${PAGE_SIZE}" > "$page_file"

  count="$(jq '.result.results | length' "$page_file")"
  echo "  page $page returned $count results" >&2
  if [[ "$count" == "0" ]]; then
    break
  fi
  page=$((page + 1))
done

echo "Merging pages into $OUT_FILE..." >&2
jq -s '[.[].result.results[]]' "$TMP_DIR"/page-*.json > "$OUT_FILE"
echo "Wrote $(jq 'length' "$OUT_FILE") entries to $OUT_FILE." >&2