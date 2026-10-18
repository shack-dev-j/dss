#!/bin/sh
# Runs inside the "backup" container: one backup per day at BACKUP_HOUR_UTC. A failed run is logged and retried in 1 hour.
. /scripts/backup-lib.sh
hour="${BACKUP_HOUR_UTC:-21}"
while true; do
  now="$(date -u +%s)"
  today="$(date -u +%Y-%m-%d)"
  target="$(date -u -d "$today $(printf '%02d' "$hour"):00:00" +%s 2>/dev/null || echo $((now + 86400)))"
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo "[backup] next run in $((target - now)) seconds"
  sleep $((target - now))
  until do_backup; do echo "[backup] retrying in 1 hour" >&2; sleep 3600; done
done
