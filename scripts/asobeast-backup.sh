#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/asobeast-backups}"
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
BACKUP_KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
BACKUP_AGE="${BACKUP_AGE:-age}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_REMOTE_KEEP_DAILY="${BACKUP_REMOTE_KEEP_DAILY:-${BACKUP_KEEP_DAILY}}"
BACKUP_REMOTE_KEEP_WEEKLY="${BACKUP_REMOTE_KEEP_WEEKLY:-${BACKUP_KEEP_WEEKLY}}"
BACKUP_RCLONE="${BACKUP_RCLONE:-rclone}"
BACKUP_REDIS_SERVICE="${BACKUP_REDIS_SERVICE:-redis}"
BACKUP_REDIS_DB="${BACKUP_REDIS_DB:-0}"
BACKUP_DATABASE="${BACKUP_DATABASE:-asobeast}"
BACKUP_USER="${BACKUP_USER:-asobeast}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
COMPOSE_PATH_SEPARATOR="${COMPOSE_PATH_SEPARATOR:-:}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-}"
WEEKLY_DAY="${WEEKLY_DAY:-7}"
LAST_BACKUP_KEY="asobeast:last-backup"

if [ -n "${BACKUP_AGE_RECIPIENT}" ] && ! command -v "${BACKUP_AGE}" >/dev/null 2>&1; then
  echo "BACKUP_AGE_RECIPIENT is set but \"${BACKUP_AGE}\" is not on PATH. An archive that leaves this host is encrypted first, so the run stops rather than producing a plaintext copy." >&2
  exit 1
fi

if [ -n "${BACKUP_REMOTE}" ] && [ -z "${BACKUP_AGE_RECIPIENT}" ]; then
  echo "BACKUP_REMOTE is set but BACKUP_AGE_RECIPIENT is not. An archive holds every password hash, session and billing identifier this instance has, so it is never pushed to storage you do not control in plaintext." >&2
  exit 1
fi

if [ -n "${BACKUP_REMOTE}" ] && ! command -v "${BACKUP_RCLONE}" >/dev/null 2>&1; then
  echo "BACKUP_REMOTE is set but \"${BACKUP_RCLONE}\" is not on PATH, so the archive would never leave this host." >&2
  exit 1
fi

if [ -z "${COMPOSE_FILE}" ]; then
  echo "COMPOSE_FILE is required and must be the absolute path of the deployment's compose file, for example COMPOSE_FILE=/srv/asobeast/docker-compose.yml. Compose finds a deployment through its file, not through COMPOSE_PROJECT, and a scheduled run does not start in the repository." >&2
  exit 1
fi

COMPOSE_ARGS=()
IFS="${COMPOSE_PATH_SEPARATOR}" read -r -a COMPOSE_PATHS <<<"${COMPOSE_FILE}"
for path in "${COMPOSE_PATHS[@]}"; do
  case "${path}" in
    /*) ;;
    *)
      echo "COMPOSE_FILE must list absolute paths. \"${path}\" is relative, and a scheduled run resolves it against a working directory you did not choose." >&2
      exit 1
      ;;
  esac
  if [ ! -r "${path}" ]; then
    echo "COMPOSE_FILE names \"${path}\", which is not a readable file." >&2
    exit 1
  fi
  COMPOSE_ARGS+=(-f "${path}")
done

if [ -n "${COMPOSE_PROJECT}" ]; then
  COMPOSE_ARGS+=(-p "${COMPOSE_PROJECT}")
fi

compose() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

prune() {
  local directory="$1"
  local keep="$2"
  local stale
  stale="$(ls -1t "${directory}"/asobeast-*.dump 2>/dev/null | tail -n "+$((keep + 1))" || true)"
  [ -n "${stale}" ] || return 0
  printf '%s\n' "${stale}" | while IFS= read -r archive; do
    rm -f -- "${archive}" "${archive}.age"
    echo "pruned ${archive}"
  done
}

encrypt() {
  local archive="$1"
  local encrypted="${archive}.age"
  local partial="${encrypted}.partial"

  "${BACKUP_AGE}" --encrypt --recipient "${BACKUP_AGE_RECIPIENT}" \
    --output "${partial}" -- "${archive}"
  test -s "${partial}"
  mv -- "${partial}" "${encrypted}"
  echo "${encrypted}"
}

remote_size() {
  "${BACKUP_RCLONE}" lsjson -- "$1" 2>/dev/null |
    sed -n 's/.*"Size":\([0-9-]*\).*/\1/p' | head -n 1
}

upload() {
  local source="$1"
  local destination="$2"
  local expected actual

  "${BACKUP_RCLONE}" copyto -- "${source}" "${destination}"

  expected="$(wc -c <"${source}" | tr -d ' ')"
  actual="$(remote_size "${destination}")"
  if [ "${actual}" != "${expected}" ]; then
    "${BACKUP_RCLONE}" deletefile -- "${destination}" >/dev/null 2>&1 || true
    echo "The upload of ${destination} reported success but reads back as \"${actual:-nothing}\" bytes instead of ${expected}. The short object has been removed so pruning cannot mistake it for a backup." >&2
    exit 1
  fi
  echo "${destination}"
}

copy_remote() {
  local source="$1"
  local destination="$2"
  local expected actual

  "${BACKUP_RCLONE}" copyto -- "${source}" "${destination}"

  expected="$(remote_size "${source}")"
  actual="$(remote_size "${destination}")"
  if [ "${actual}" != "${expected}" ]; then
    "${BACKUP_RCLONE}" deletefile -- "${destination}" >/dev/null 2>&1 || true
    echo "The offsite copy ${destination} reads back as \"${actual:-nothing}\" bytes instead of ${expected}. The short object has been removed so pruning cannot mistake it for a backup." >&2
    exit 1
  fi
  echo "${destination}"
}

prune_remote() {
  local directory="$1"
  local keep="$2"
  local stale
  stale="$("${BACKUP_RCLONE}" lsf --files-only -- "${directory}" 2>/dev/null |
    grep -E '^asobeast-.*\.dump\.age$' | sort -r | tail -n "+$((keep + 1))" || true)"
  [ -n "${stale}" ] || return 0
  printf '%s\n' "${stale}" | while IFS= read -r name; do
    "${BACKUP_RCLONE}" deletefile -- "${directory}/${name}"
    echo "pruned ${directory}/${name}"
  done
}

report_completion() {
  local at
  at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if compose exec -T "${BACKUP_REDIS_SERVICE}" \
    redis-cli -n "${BACKUP_REDIS_DB}" SET "${LAST_BACKUP_KEY}" "${at}" >/dev/null; then
    echo "reported ${LAST_BACKUP_KEY}=${at}"
    return 0
  fi
  echo "The backup finished but could not report to redis, so the instance will report it as stale until the next run does." >&2
}

DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"
chmod 700 "${BACKUP_ROOT}" "${DAILY_DIR}" "${WEEKLY_DIR}"

rm -f -- "${DAILY_DIR}"/asobeast-*.dump.partial "${DAILY_DIR}"/asobeast-*.dump.age.partial

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${DAILY_DIR}/asobeast-${STAMP}.dump"
PARTIAL="${ARCHIVE}.partial"

cleanup_partial() {
  rm -f -- "${PARTIAL}" "${ARCHIVE}.age.partial"
}
trap cleanup_partial EXIT

compose exec -T postgres pg_dump \
  --username "${BACKUP_USER}" --dbname "${BACKUP_DATABASE}" --format=custom >"${PARTIAL}"

test -s "${PARTIAL}"
compose exec -T postgres pg_restore --list <"${PARTIAL}" >/dev/null

mv -- "${PARTIAL}" "${ARCHIVE}"
echo "${ARCHIVE}"

ENCRYPTED=""
if [ -n "${BACKUP_AGE_RECIPIENT}" ]; then
  ENCRYPTED="$(encrypt "${ARCHIVE}")"
  echo "${ENCRYPTED}"
fi
trap - EXIT

WEEKLY_TODAY=false
if [ "$(date -u +%u)" = "${WEEKLY_DAY}" ]; then
  WEEKLY_TODAY=true
  cp -- "${ARCHIVE}" "${WEEKLY_DIR}/asobeast-${STAMP}.dump"
  echo "${WEEKLY_DIR}/asobeast-${STAMP}.dump"
fi

if [ -n "${BACKUP_REMOTE}" ]; then
  REMOTE_DAILY="$(upload "${ENCRYPTED}" "${BACKUP_REMOTE}/daily/asobeast-${STAMP}.dump.age")"
  echo "${REMOTE_DAILY}"
  if [ "${WEEKLY_TODAY}" = true ]; then
    copy_remote "${REMOTE_DAILY}" "${BACKUP_REMOTE}/weekly/asobeast-${STAMP}.dump.age"
  fi
  rm -f -- "${ENCRYPTED}"
fi

prune "${DAILY_DIR}" "${BACKUP_KEEP_DAILY}"
prune "${WEEKLY_DIR}" "${BACKUP_KEEP_WEEKLY}"

if [ -n "${BACKUP_REMOTE}" ]; then
  prune_remote "${BACKUP_REMOTE}/daily" "${BACKUP_REMOTE_KEEP_DAILY}"
  prune_remote "${BACKUP_REMOTE}/weekly" "${BACKUP_REMOTE_KEEP_WEEKLY}"
fi

report_completion
