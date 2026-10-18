#!/bin/bash
# NamPS OS — restore a backup. REPLACES the current database (and uploads, if an uploads archive is given).
# Usage: ./scripts/restore.sh backups/db_YYYYMMDD_HHMMSS.dump [backups/uploads_YYYYMMDD_HHMMSS.tar.gz] [--yes]
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP="${1:-}"; UPLOADS=""; YES=""
shift || true
for a in "$@"; do case "$a" in --yes) YES=1 ;; *) UPLOADS="$a" ;; esac; done

[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "Usage: $0 <db_*.dump> [uploads_*.tar.gz] [--yes]"; exit 1; }
[ -z "$UPLOADS" ] || [ -f "$UPLOADS" ] || { echo "Uploads archive not found: $UPLOADS"; exit 1; }

echo "This will REPLACE the live database with: $DUMP"
[ -z "$UPLOADS" ] || echo "and the homework uploads with: $UPLOADS"
if [ -z "$YES" ]; then read -r -p "Type 'restore' to continue: " ok; [ "$ok" = "restore" ] || { echo "Cancelled."; exit 0; }; fi

echo "== stopping the app"
docker compose stop app
echo "== restoring the database"
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DUMP"
if [ -n "$UPLOADS" ]; then
  echo "== restoring uploads"
  # Run as the app image (it owns the uploads volume read-write) with the backups folder mounted read-only.
  docker compose run --rm --no-deps -T -v "$(pwd)/$(dirname "$UPLOADS"):/in:ro" --entrypoint sh app -c \
    "find /app/uploads -mindepth 1 -delete && tar -C /app/uploads -xzf /in/$(basename "$UPLOADS")"
fi
echo "== starting the app"
docker compose start app
echo "Restore finished. Run ./scripts/verify-restore.sh to double-check."
