#!/bin/bash
# NamPS OS — take a backup right now (the "backup" container also does this daily).
# Usage (from the project folder on the server): ./scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T backup sh -c '. /scripts/backup-lib.sh && do_backup'
echo "Backups are in ./backups — copy them off this machine too (another disk, another computer)."
ls -lh backups | tail -n 6
