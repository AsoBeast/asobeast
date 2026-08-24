#!/usr/bin/env bash
set -euo pipefail

DRILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${DRILL_DIR}/../.." && pwd)"
REPO_DIR="$(cd "${API_DIR}/../.." && pwd)"

PORT="${SHUTDOWN_DRILL_PORT:-4320}"
BASE_URL="http://127.0.0.1:${PORT}"
DRAIN_TIMEOUT_SECONDS="${SHUTDOWN_DRAIN_TIMEOUT_SECONDS:-30}"
SHUTDOWN_MARKER="stopped on SIGTERM"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

DATABASE_NAME="${DATABASE_URL%%\?*}"
case "${DATABASE_NAME}" in
  *_shutdown) ;;
  *)
    echo "DATABASE_URL must name a drill database ending in _shutdown. This boots the api against it and would otherwise share state with another suite." >&2
    exit 1
    ;;
esac

WORK="$(mktemp -d)"
API_LOG="${WORK}/api.log"
API_PID=""

cleanup() {
  if [ -n "${API_PID}" ] && kill -0 "${API_PID}" 2>/dev/null; then
    kill -9 "${API_PID}" 2>/dev/null || true
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

echo "==> Building the api"
(cd "${API_DIR}" && pnpm exec prisma generate >/dev/null)
(cd "${REPO_DIR}" && pnpm run build:packages >/dev/null)
(cd "${API_DIR}" && pnpm run build >/dev/null)

echo "==> Deploying the schema"
(cd "${API_DIR}" && DATABASE_URL="${DATABASE_URL}" pnpm exec prisma migrate deploy >/dev/null)

echo "==> Starting the api"
(
  cd "${API_DIR}" &&
    exec env PORT="${PORT}" \
      DATABASE_URL="${DATABASE_URL}" \
      REDIS_HOST="${REDIS_HOST:-localhost}" \
      REDIS_PORT="${REDIS_PORT:-6380}" \
      REDIS_DB="${SHUTDOWN_REDIS_DB:-7}" \
      AUTH_SECRET="${AUTH_SECRET:-shutdown-drill-secret-shutdown-drill-secret}" \
      BULL_BOARD_ENABLED=false \
      LOG_LEVEL=log \
      node dist/main.js
) >"${API_LOG}" 2>&1 &
API_PID=$!

echo "==> Waiting for the api to report healthy"
READY=0
for _ in $(seq 1 60); do
  if curl --silent --fail --max-time 10 --output /dev/null "${BASE_URL}/health"; then
    READY=1
    break
  fi
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    fail "The api exited before it became healthy."
  fi
  sleep 1
done

[ "${READY}" -eq 1 ] ||
  fail "The api never answered ${BASE_URL}/health, so nothing below would have tested a running api."

echo "==> Sending SIGTERM"
STARTED_AT="$(date +%s)"
kill -TERM "${API_PID}"

for _ in $(seq 1 "${DRAIN_TIMEOUT_SECONDS}"); do
  kill -0 "${API_PID}" 2>/dev/null || break
  sleep 1
done

if kill -0 "${API_PID}" 2>/dev/null; then
  fail "The api was still running ${DRAIN_TIMEOUT_SECONDS}s after SIGTERM."
fi

EXIT_STATUS=0
wait "${API_PID}" 2>/dev/null || EXIT_STATUS=$?
API_PID=""
ELAPSED="$(( $(date +%s) - STARTED_AT ))"
echo "    the api stopped after ${ELAPSED}s"

case "${EXIT_STATUS}" in
  0 | 143) ;;
  137)
    fail "The api was killed with SIGKILL rather than stopping on SIGTERM."
    ;;
  *)
    fail "The api exited with ${EXIT_STATUS} rather than stopping on SIGTERM."
    ;;
esac

echo "==> Checking the api reported a clean shutdown"
grep --quiet "${SHUTDOWN_MARKER}" "${API_LOG}" ||
  fail "The api never reported '${SHUTDOWN_MARKER}', so its shutdown hooks did not run."

echo "==> SIGTERM runs the shutdown hooks and the process stops on its own"
echo "    what a signal does to a job that is already running is asserted by shutdown-drain.e2e-spec.ts"
