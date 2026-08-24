#!/usr/bin/env bash
set -euo pipefail

DRILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${DRILL_DIR}/../.." && pwd)"
REPO_DIR="$(cd "${API_DIR}/../.." && pwd)"

DRILL_TOKEN="asob_0123456789abcdef0123456789abcdef0123456789abcdef"
BASE_URL="http://127.0.0.1:${UPGRADE_BOOT_PORT:-4310}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

DATABASE_NAME="${DATABASE_URL%%\?*}"
case "${DATABASE_NAME}" in
  *_upgrade | *_backup_target) ;;
  *)
    echo "DATABASE_URL must name a drill database ending in _upgrade or _backup_target. This authenticates with the fixture's well known token and writes to the database." >&2
    exit 1
    ;;
esac

WORK="$(mktemp -d)"
API_LOG="${WORK}/api.log"
API_PID=""

cleanup() {
  if [ -n "${API_PID}" ] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
  rm -rf "${WORK}"
}
trap cleanup EXIT

fail() {
  echo "$1" >&2
  echo "--- api log ---" >&2
  cat "${API_LOG}" >&2
  exit 1
}

authorized_get() {
  curl --silent --show-error --max-time 30 --output "${WORK}/body.json" --write-out '%{http_code}' \
    --header "Authorization: Bearer ${DRILL_TOKEN}" "${BASE_URL}$1"
}

assert_read() {
  local path="$1"
  local filter="$2"
  local status
  status="$(authorized_get "${path}")"
  if [ "${status}" -lt 200 ] || [ "${status}" -ge 300 ]; then
    echo "--- response ---" >&2
    cat "${WORK}/body.json" >&2
    fail "GET ${path} answered ${status}"
  fi
  if ! jq --exit-status "${filter}" "${WORK}/body.json" >/dev/null; then
    echo "--- response ---" >&2
    cat "${WORK}/body.json" >&2
    fail "GET ${path} did not carry the fixture data"
  fi
  echo "    ${path} ${status}"
}

echo "==> Building the api"
(cd "${API_DIR}" && pnpm exec prisma generate >/dev/null)
(cd "${REPO_DIR}" && pnpm run build:packages >/dev/null)
(cd "${API_DIR}" && pnpm run build >/dev/null)

echo "==> Starting the api against the upgraded database"
(
  cd "${API_DIR}" &&
    exec env PORT="${UPGRADE_BOOT_PORT:-4310}" \
      DATABASE_URL="${DATABASE_URL}" \
      REDIS_HOST="${REDIS_HOST:-localhost}" \
      REDIS_PORT="${REDIS_PORT:-6380}" \
      REDIS_DB="${UPGRADE_REDIS_DB:-6}" \
      AUTH_SECRET="${AUTH_SECRET:-upgrade-drill-secret-upgrade-drill-secret}" \
      BULL_BOARD_ENABLED=false \
      LOG_LEVEL=warn \
      node dist/main.js
) >"${API_LOG}" 2>&1 &
API_PID=$!

echo "==> Waiting for the api to report healthy"
for _ in $(seq 1 60); do
  if curl --silent --fail --max-time 10 --output "${WORK}/health.json" "${BASE_URL}/health"; then
    break
  fi
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    fail "The api exited before it became healthy."
  fi
  sleep 1
done

jq --exit-status '.status == "ok" and .db == "up"' "${WORK}/health.json" >/dev/null ||
  fail "The api did not report a healthy database."
jq --exit-status '.pipeline != null and (.pipeline.failedJobs | type) == "number"' \
  "${WORK}/health.json" >/dev/null ||
  fail "The api did not report pipeline health."

echo "==> Reading every domain a migration touched"
assert_read "/auth/me" '.email == "owner@asobeast.test" and .role == "owner"'
assert_read "/apps" '[.[] | .id] | index("app_ios") != null and index("app_play") != null'
assert_read "/apps/app_ios" '.competitors | map(.id) | index("app_rival") != null'
assert_read "/apps/app_ios/keywords" '[.[] | .text] | index("workout tracker") != null'
assert_read "/apps/app_ios/keywords?country=gb" '[.[] | .country] | all(. == "gb")'
assert_read "/apps/app_ios/rankings" '.series | length > 0'
assert_read "/apps/app_ios/reviews" '[.reviews[].reviewId] | index("r-2") != null'
assert_read "/apps/app_ios/changes" '[.events[].field] | index("description") != null'
assert_read "/actions" '.items | type == "array"'
assert_read "/actions/summary" '.open | type == "number"'
assert_read "/webhooks" '[.[] | .url] | index("https://hooks.test/asobeast") != null'
assert_read "/email-alerts" '[.[] | .email] | index("alerts@asobeast.test") != null'
assert_read "/jobs/budget" '.total | type == "number"'

echo "==> Writing through the api so a mis-restored key allocation would surface"
WRITE_STATUS="$(curl --silent --show-error --max-time 30 --output "${WORK}/write.json" --write-out '%{http_code}' \
  --request POST \
  --header "Authorization: Bearer ${DRILL_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data '{"keywords":["drill write probe"],"country":"us"}' \
  "${BASE_URL}/apps/app_ios/keywords")"
if [ "${WRITE_STATUS}" -lt 200 ] || [ "${WRITE_STATUS}" -ge 300 ]; then
  echo "--- response ---" >&2
  cat "${WORK}/write.json" >&2
  fail "POST /apps/app_ios/keywords answered ${WRITE_STATUS}"
fi
jq --exit-status '[.[].text] | index("drill write probe") != null' "${WORK}/write.json" >/dev/null ||
  fail "The written keyword did not come back from the api."
echo "    POST /apps/app_ios/keywords ${WRITE_STATUS}"

echo "==> The api boots, reads and writes on the database under test"
