#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.staging"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it from .env.staging.example first."
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in ${ENV_FILE}"
  exit 1
fi

cd "${ROOT_DIR}"
MAX_ATTEMPTS=15
ATTEMPT=1

until corepack yarn workspace @tchuno/database prisma migrate deploy; do
  if [[ "${ATTEMPT}" -ge "${MAX_ATTEMPTS}" ]]; then
    echo "Failed to apply migrations after ${MAX_ATTEMPTS} attempts."
    exit 1
  fi

  echo "Database not ready yet. Retry ${ATTEMPT}/${MAX_ATTEMPTS} in 2s..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 2
done

corepack yarn workspace @tchuno/database prisma db seed

echo "Staging bootstrap completed."
