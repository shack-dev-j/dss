#!/bin/sh
# Shared by backup.sh and the daily backup container. Needs PGHOST/PGUSER/PGPASSWORD/PGDATABASE in the environment.
# Writes <BACKUP_DIR>/db_<stamp>.dump (pg_dump custom format) and uploads_<stamp>.tar.gz, then prunes old ones.

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

do_backup() {
  stamp="$(date -u +%Y%m%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR" || return 1
  dump="$BACKUP_DIR/db_${stamp}.dump"

  echo "[backup] $(date -u) dumping database to $dump"
  if ! pg_dump --format=custom --no-owner --file="$dump.tmp"; then
    rm -f "$dump.tmp"; echo "[backup] FAILED: pg_dump" >&2; return 1
  fi
  # A dump that cannot even be listed is worthless: fail loudly now, not at restore time.
  if ! pg_restore --list "$dump.tmp" >/dev/null; then
    rm -f "$dump.tmp"; echo "[backup] FAILED: dump is unreadable" >&2; return 1
  fi
  mv "$dump.tmp" "$dump"

  if [ -d "$UPLOADS_DIR" ]; then
    if ! tar -C "$UPLOADS_DIR" -czf "$BACKUP_DIR/uploads_${stamp}.tar.gz.tmp" . ; then
      rm -f "$BACKUP_DIR/uploads_${stamp}.tar.gz.tmp"; echo "[backup] FAILED: uploads archive" >&2; return 1
    fi
    mv "$BACKUP_DIR/uploads_${stamp}.tar.gz.tmp" "$BACKUP_DIR/uploads_${stamp}.tar.gz"
  fi

  # Retention: delete backups older than BACKUP_KEEP_DAYS, but never the newest one of each kind.
  for kind in db uploads; do
    newest="$(ls -1 "$BACKUP_DIR"/${kind}_* 2>/dev/null | sort | tail -n 1)"
    find "$BACKUP_DIR" -maxdepth 1 -name "${kind}_*" -mtime "+$BACKUP_KEEP_DAYS" ! -path "$newest" -exec rm -f {} \;
  done
  echo "[backup] done: $(basename "$dump") ($(du -h "$dump" | cut -f1))"
}
