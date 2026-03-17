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

API_PORT="${API_PORT:-3001}"
API_BASE="http://localhost:${API_PORT}"

echo "Checking API health at ${API_BASE}/observability/health"
curl --fail --silent --show-error "${API_BASE}/observability/health" >/dev/null
echo "Health endpoint is responding."

echo "Checking Swagger docs at ${API_BASE}/docs"
curl --fail --silent --show-error "${API_BASE}/docs" >/dev/null
echo "Docs endpoint is responding."
