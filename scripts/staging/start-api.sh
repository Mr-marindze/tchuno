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

cd "${ROOT_DIR}"
corepack yarn workspace @tchuno/api start:dev
