#!/usr/bin/env bash
# Re-download the sixteen engine marks into public/engines/.
#
# The prototype hot-linked jsDelivr and cdn.simpleicons.org. Production self-hosts
# them: @latest is a moving target, and a CDN outage must not take the page with
# it. devicon is pinned; simpleicons has no version in the URL, so the downloaded
# files are committed and this script is only for a deliberate refresh.
#
# Note two ids do not match their upstream slug: libsql is served as `turso`, and
# druid as `apachedruid`. Renaming them to match breaks the fetch.
#
# Marks are third-party trademarks — never recoloured. Run
# `node scripts/logo-contrast-report.mjs` afterwards to see how each reads on the
# white hexagon plate.
set -euo pipefail

DEV="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons"
SI="https://cdn.simpleicons.org"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/engines"
mkdir -p "$OUT"

fetch() { # id url
  local code
  code=$(curl -sS --fail-with-body -o "$OUT/$1.svg" -w '%{http_code}' "$2") || {
    echo "FAILED $1 <- $2" >&2; return 1
  }
  grep -q '</svg>' "$OUT/$1.svg" || { echo "NOT SVG $1 <- $2" >&2; return 1; }
  printf '%-15s %s %6s bytes\n' "$1" "$code" "$(wc -c <"$OUT/$1.svg" | tr -d ' ')"
}

fetch postgresql    "$DEV/postgresql/postgresql-original.svg"
fetch mysql         "$DEV/mysql/mysql-original.svg"
fetch oracle        "$DEV/oracle/oracle-original.svg"
fetch sqlserver     "$DEV/microsoftsqlserver/microsoftsqlserver-plain.svg"
fetch sqlite        "$DEV/sqlite/sqlite-original.svg"
fetch mongodb       "$DEV/mongodb/mongodb-original.svg"
fetch couchbase     "$DEV/couchbase/couchbase-original.svg"
fetch redis         "$DEV/redis/redis-original.svg"
fetch cassandra     "$DEV/cassandra/cassandra-original.svg"
fetch elasticsearch "$DEV/elasticsearch/elasticsearch-original.svg"
fetch libsql        "$SI/turso"
fetch duckdb        "$SI/duckdb"
fetch clickhouse    "$SI/clickhouse"
fetch druid         "$SI/apachedruid"
fetch trino         "$SI/trino"
fetch opensearch    "$SI/opensearch"

echo
echo "16 marks in $OUT"
