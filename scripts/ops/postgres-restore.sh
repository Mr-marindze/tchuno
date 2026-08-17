#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DATABASE_URL="${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}"

normalize_database_url() {
  local url="${1:-}"
  printf '%s' "${url%%\?*}"
}

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: RESTORE_DATABASE_URL=postgresql://... scripts/ops/postgres-restore.sh <backup-file>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "RESTORE_DATABASE_URL or DATABASE_URL is required for PostgreSQL restore."
  exit 1
fi

if [[ "${RESTORE_CONFIRM:-}" != "restore" ]]; then
  echo "Set RESTORE_CONFIRM=restore to acknowledge that restore mutates the target database."
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required but was not found in PATH."
  exit 1
fi

NORMALIZED_TARGET_DATABASE_URL="$(normalize_database_url "${TARGET_DATABASE_URL}")"

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "${NORMALIZED_TARGET_DATABASE_URL}" \
  "${BACKUP_FILE}"

echo "Restore completed from ${BACKUP_FILE}"
