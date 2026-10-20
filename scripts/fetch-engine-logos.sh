#!/usr/bin/env bash
# Re-download the twenty fetched engine marks into public/engines/.
#
# Ten more marks in public/engines/ are NOT fetched and this script never touches
# them: libredb.svg is our own, and eight come from the product's own icon set,
# libredb-studio/src/components/icons/db-icons.tsx, copied as static SVG:
#   - db2, neo4j, milvus, qdrant, influxdb, influxdb3, oxia: marks drawn for
#     Studio, deliberately not the vendor's logo. The product decided that per
#     engine (Neo4j's provider doc lists "never Neo4j's logo" as a known
#     limitation; InfluxDB, Milvus, Qdrant and Oxia say the same in their icon
#     comments), so the site does not use a vendor mark the product refuses.
#     Db2 has no mark on either CDN anyway. Stroke #334155.
#   - databend: Databend's official icon (databend.com/brand, "Icon · Light"),
#     used at the Databend team's request (databendlabs/databend-docs#3512);
#     paths and colours unchanged.
#
# The prototype hot-linked jsDelivr and cdn.simpleicons.org. Production self-hosts
# them: @latest is a moving target, and a CDN outage must not take the page with
# it. devicon is pinned; simpleicons has no version in the URL, so the downloaded
# files are committed and this script is only for a deliberate refresh.
#
# Note three ids do not match their upstream slug: libsql is served as `turso`,
# druid as `apachedruid` and kafka as `apachekafka`. Renaming them to match breaks the fetch.
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
fetch prometheus    "$SI/prometheus"
fetch kafka         "$SI/apachekafka"
fetch etcd          "$SI/etcd"
fetch mariadb       "$SI/mariadb"

echo
echo "20 marks in $OUT"
