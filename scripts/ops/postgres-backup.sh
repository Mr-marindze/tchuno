#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-"${ROOT_DIR}/backups/postgres"}"

normalize_database_url() {
  local url="${1:-}"
  printf '%s' "${url%%\?*}"
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for PostgreSQL backup."
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but was not found in PATH."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}" 2>/dev/null || true

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_FILE="${BACKUP_DIR}/tchuno-postgres-${TIMESTAMP}.dump"

if [[ -e "${BACKUP_FILE}" ]]; then
  echo "Backup file already exists: ${BACKUP_FILE}"
  exit 1
fi

NORMALIZED_DATABASE_URL="$(normalize_database_url "${DATABASE_URL}")"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "${BACKUP_FILE}" \
  "${NORMALIZED_DATABASE_URL}"

echo "Backup written to ${BACKUP_FILE}"
