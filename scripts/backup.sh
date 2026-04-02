#!/usr/bin/env bash
# ============================================================
# OpenServe OS — Database Backup Script
# Usage:  ./scripts/backup.sh [tenant-name]
# Saves:  backups/<tenant>/<timestamp>.sql.gz
# ============================================================
set -euo pipefail

TENANT="${1:-default}"
BACKUP_DIR="$(dirname "$0")/../backups/${TENANT}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${TIMESTAMP}.sql.gz"

# Load .env if present
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Parse DATABASE_URL or fall back to individual vars
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_URL="$DATABASE_URL"
else
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-openserve}"
  DB_USER="${DB_USER:-dev}"
  DB_PASSWORD="${DB_PASSWORD:-dev123}"
  DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

mkdir -p "$BACKUP_DIR"

echo "📦  Backing up tenant: ${TENANT}"
echo "    Destination: ${BACKUP_DIR}/${FILENAME}"

pg_dump "$DB_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "✅  Done — ${SIZE} written"

# Keep only last 30 backups per tenant
cd "$BACKUP_DIR"
ls -t *.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
KEPT=$(ls *.sql.gz 2>/dev/null | wc -l)
echo "    Retained ${KEPT} backup(s) in ${BACKUP_DIR}"
