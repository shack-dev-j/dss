#!/bin/bash
# NamPS OS — prove that the newest backup can actually be restored.
# Restores it into a scratch database next to the live one, compares row counts, then drops the scratch database.
# Usage: ./scripts/verify-restore.sh [backups/db_*.dump]      (default: newest)
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP="${1:-$(ls -1 backups/db_*.dump 2>/dev/null | sort | tail -n 1)}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "No backup found in ./backups"; exit 1; }
SCRATCH="namps_restore_check"
psql_db() { docker compose exec -T db sh -c "psql -v ON_ERROR_STOP=1 -At -U \"\$POSTGRES_USER\" -d $1 -c \"$2\""; }

echo "Verifying $DUMP"
start=$(date +%s)
psql_db postgres "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null
psql_db postgres "CREATE DATABASE $SCRATCH" >/dev/null
trap 'psql_db postgres "DROP DATABASE IF EXISTS '"$SCRATCH"'" >/dev/null || true' EXIT
docker compose exec -T db sh -c "pg_restore --no-owner --exit-on-error -U \"\$POSTGRES_USER\" -d $SCRATCH" < "$DUMP"
secs=$(( $(date +%s) - start ))

fail=0
printf '%-28s %10s %10s\n' table backup live
for t in users students classes marks assessments attendance homework audit_log; do
  b=$(psql_db "$SCRATCH" "select count(*) from $t")
  l=$(psql_db '"$POSTGRES_DB"' "select count(*) from $t" 2>/dev/null || echo "?")
  printf '%-28s %10s %10s\n' "$t" "$b" "$l"
  [ "$t" = users ] && [ "$b" -eq 0 ] && fail=1
done
[ "$fail" -eq 0 ] && echo "PASS — restored in ${secs}s (counts may differ from live if data changed since the backup)" || { echo "FAIL — restored database has no users"; exit 1; }
