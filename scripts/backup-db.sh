#!/usr/bin/env bash
# Dump the ReplyIQ database to a timestamped, gzipped file.
#
# Render's FREE PostgreSQL plan has no backups of any kind, and the instance is
# deleted 30 days after creation (plus a 14-day grace period in which upgrading
# to a paid plan preserves the data). Until you are on a paid plan, this script
# is the only thing standing between you and losing every signup.
#
#   ./scripts/backup-db.sh                      # uses $DATABASE_URL
#   ./scripts/backup-db.sh "postgres://..."     # or an explicit URL
#
# Get the external connection string from the Render dashboard:
#   replyiq-db → Connect → External Database URL
#
# Restore with:
#   gunzip -c backups/replyiq-YYYYmmdd-HHMMSS.sql.gz | psql "<target-url>"

set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "error: no database URL. Pass one as an argument or set DATABASE_URL." >&2
  exit 1
fi

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/replyiq-$STAMP.sql.gz"

if ! command -v pg_dump >/dev/null 2>&1; then
  # No local pg_dump: borrow the one inside the running Postgres container so
  # this works on a machine with only Docker installed.
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^replyiq-postgres$'; then
    echo "pg_dump not found locally; using the replyiq-postgres container."
    docker exec replyiq-postgres pg_dump --no-owner --no-privileges "$DB_URL" | gzip > "$OUT_FILE"
  else
    echo "error: pg_dump not found and no replyiq-postgres container running." >&2
    exit 1
  fi
else
  pg_dump --no-owner --no-privileges "$DB_URL" | gzip > "$OUT_FILE"
fi

echo "Wrote $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Keep the last 14 dumps; older ones are noise and eat disk.
ls -1t "$OUT_DIR"/replyiq-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
