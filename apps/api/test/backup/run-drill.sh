#!/usr/bin/env bash
set -euo pipefail

DRILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${DRILL_DIR}/../.." && pwd)"
REPO_DIR="$(cd "${API_DIR}/../.." && pwd)"
FIXTURE="${API_DIR}/test/upgrade/fixture-baseline.sql"

SOURCE_DB="${SOURCE_DB:-asobeast_backup_source}"
TARGET_DB="${TARGET_DB:-asobeast_backup_target}"
PGUSER_NAME="${PGUSER_NAME:-asobeast}"
COMPOSE=(docker compose -f "${REPO_DIR}/docker-compose.dev.yml")

if [[ "${SOURCE_DB}" != *_backup_source ]] || [[ "${TARGET_DB}" != *_backup_target ]]; then
  echo "SOURCE_DB must end in _backup_source and TARGET_DB in _backup_target. This script drops both." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

ARCHIVE="${WORK}/asobeast.dump"

compose_psql() {
  "${COMPOSE[@]}" exec -T postgres psql --username "${PGUSER_NAME}" --dbname "$1" \
    --quiet --no-psqlrc -v ON_ERROR_STOP=1 "${@:2}"
}

recreate_database() {
  "${COMPOSE[@]}" exec -T postgres dropdb --username "${PGUSER_NAME}" --if-exists "$1"
  "${COMPOSE[@]}" exec -T postgres createdb --username "${PGUSER_NAME}" "$1"
}

fingerprint() {
  compose_psql "$1" --tuples-only --no-align <<'SQL'
SELECT format(
         '%s %s %s',
         table_name,
         row_count,
         coalesce(checksum, 'empty')
       )
FROM (
  SELECT
    c.relname AS table_name,
    (SELECT count(*) FROM pg_catalog.pg_class WHERE oid = c.oid) * 0 +
      (xpath('/row/c/text()',
             query_to_xml(format('SELECT count(*) AS c FROM %I', c.relname),
                          false, true, '')))[1]::text::bigint AS row_count,
    (xpath('/row/c/text()',
           query_to_xml(format(
             'SELECT md5(coalesce(string_agg(t::text, %L ORDER BY t::text), %L)) AS c FROM %I t',
             '|', '', c.relname),
             false, true, '')))[1]::text AS checksum
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname <> '_prisma_migrations'
) tables
ORDER BY table_name;
SQL
}

echo "==> Provisioning the source database"
recreate_database "${SOURCE_DB}"
(cd "${API_DIR}" && DATABASE_URL="postgresql://${PGUSER_NAME}:${PGUSER_NAME}@localhost:5433/${SOURCE_DB}" \
  pnpm exec prisma migrate deploy >/dev/null)

echo "==> Loading the fixture"
compose_psql "${SOURCE_DB}" <<'SQL' >/dev/null
ALTER TABLE "KeywordRanking" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "planExpiresAt" TIMESTAMP(3),
  ADD COLUMN "billingCustomerId" TEXT;
SQL
compose_psql "${SOURCE_DB}" <"${FIXTURE}" >/dev/null
compose_psql "${SOURCE_DB}" <<'SQL' >/dev/null
UPDATE "KeywordRanking" AS r
SET "workspaceId" = a."workspaceId"
FROM "App" AS a
WHERE a."id" = r."appId" AND r."workspaceId" IS NULL;
ALTER TABLE "KeywordRanking" ALTER COLUMN "workspaceId" SET NOT NULL;

UPDATE "Workspace" w
SET "plan" = o."plan",
    "trialEndsAt" = o."trialEndsAt",
    "planExpiresAt" = o."planExpiresAt",
    "billingCustomerId" = o."billingCustomerId"
FROM (
  SELECT DISTINCT ON ("workspaceId")
         "workspaceId", "plan", "trialEndsAt", "planExpiresAt", "billingCustomerId"
  FROM "User"
  ORDER BY "workspaceId", ("role" = 'owner') DESC, "createdAt" ASC
) o
WHERE o."workspaceId" = w."id";

ALTER TABLE "User" DROP COLUMN "plan",
  DROP COLUMN "trialEndsAt",
  DROP COLUMN "planExpiresAt",
  DROP COLUMN "billingCustomerId";

UPDATE "ApiToken" SET "scope" = 'write';
SQL

echo "==> Fingerprinting the source"
fingerprint "${SOURCE_DB}" >"${WORK}/source.txt"
cat "${WORK}/source.txt"

echo "==> Taking a backup with the documented command"
"${COMPOSE[@]}" exec -T postgres pg_dump --username "${PGUSER_NAME}" --dbname "${SOURCE_DB}" \
  --format=custom >"${ARCHIVE}"
test -s "${ARCHIVE}"
"${COMPOSE[@]}" exec -T postgres pg_restore --list <"${ARCHIVE}" >/dev/null
echo "    archive $(wc -c <"${ARCHIVE}" | tr -d ' ') bytes"

echo "==> Restoring with the documented command"
recreate_database "${TARGET_DB}"
"${COMPOSE[@]}" exec -T postgres pg_restore --username "${PGUSER_NAME}" --dbname "${TARGET_DB}" \
  --clean --if-exists --no-owner --exit-on-error <"${ARCHIVE}"

echo "==> Fingerprinting the restore"
fingerprint "${TARGET_DB}" >"${WORK}/target.txt"

if ! diff -u "${WORK}/source.txt" "${WORK}/target.txt"; then
  echo "The restore does not match the source. Row counts or row contents differ." >&2
  exit 1
fi

echo "==> Asserting the migration history survived"
compose_psql "${TARGET_DB}" --tuples-only --no-align \
  -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;' \
  >"${WORK}/migrations-target.txt"
compose_psql "${SOURCE_DB}" --tuples-only --no-align \
  -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;' \
  >"${WORK}/migrations-source.txt"
diff -u "${WORK}/migrations-source.txt" "${WORK}/migrations-target.txt" ||
  { echo "The restore lost migration history, so the next boot would replay migrations." >&2; exit 1; }
echo "    $(cat "${WORK}/migrations-target.txt") applied migrations recorded"

echo "==> Asserting every sequence was restored at or above its column maximum"
compose_psql "${TARGET_DB}" --tuples-only --no-align <<'SQL' >"${WORK}/sequences.txt"
SELECT format('%s last_value %s is below %s', s.sequencename, s.last_value, used.max_value)
FROM pg_sequences s
CROSS JOIN LATERAL (
  SELECT (xpath('/row/c/text()',
                query_to_xml(format('SELECT max(%I) AS c FROM %I',
                                    d.attname, d.relname),
                             false, true, '')))[1]::text::bigint AS max_value
  FROM (
    SELECT c.relname, a.attname
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE pg_get_serial_sequence(c.relname, a.attname) = format('public.%I', s.sequencename)
    LIMIT 1
  ) d
) used
WHERE s.schemaname = 'public'
  AND coalesce(s.last_value, 0) < coalesce(used.max_value, 0);
SQL
test ! -s "${WORK}/sequences.txt" ||
  { cat "${WORK}/sequences.txt" >&2; exit 1; }
echo "    $(compose_psql "${TARGET_DB}" --tuples-only --no-align -c "SELECT count(*) FROM pg_sequences WHERE schemaname = 'public';") sequences to check"

echo "==> Asserting constraints and indexes survived"
compose_psql "${SOURCE_DB}" --tuples-only --no-align <<'SQL' >"${WORK}/constraints-source.txt"
SELECT format('%s %s %s', conrelid::regclass, conname, contype)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY 1;
SQL
compose_psql "${TARGET_DB}" --tuples-only --no-align <<'SQL' >"${WORK}/constraints-target.txt"
SELECT format('%s %s %s', conrelid::regclass, conname, contype)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY 1;
SQL
diff -u "${WORK}/constraints-source.txt" "${WORK}/constraints-target.txt" ||
  { echo "The restore lost a constraint." >&2; exit 1; }

compose_psql "${TARGET_DB}" --tuples-only --no-align <<'SQL' >"${WORK}/unique-indexes.txt"
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'AlertEvent_workspaceId_dedupeKey_key',
    'ActionItem_workspaceId_fingerprint_key',
    'App_workspaceId_store_storeAppId_country_key'
  )
ORDER BY 1;
SQL
test "$(wc -l <"${WORK}/unique-indexes.txt" | tr -d ' ')" -eq 3 ||
  { echo "A documented unique index is missing after the restore:"; cat "${WORK}/unique-indexes.txt"; exit 1; }

compose_psql "${TARGET_DB}" --tuples-only --no-align <<'SQL' >"${WORK}/unvalidated.txt"
SELECT format('%s %s is not validated', conrelid::regclass, conname)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND NOT convalidated;
SQL
test ! -s "${WORK}/unvalidated.txt" ||
  { cat "${WORK}/unvalidated.txt" >&2; exit 1; }

echo "==> Asserting a truncated archive fails before anything is dropped"
ARCHIVE_BYTES="$(wc -c <"${ARCHIVE}" | tr -d ' ')"
head -c "$(( ARCHIVE_BYTES / 2 ))" "${ARCHIVE}" >"${WORK}/truncated.dump"
TRUNCATED_BYTES="$(wc -c <"${WORK}/truncated.dump" | tr -d ' ')"
test "${TRUNCATED_BYTES}" -lt "${ARCHIVE_BYTES}" ||
  { echo "The truncated archive is the same size as the original, so this asserts nothing." >&2; exit 1; }
if "${COMPOSE[@]}" exec -T postgres pg_restore --list <"${WORK}/truncated.dump" >/dev/null 2>&1; then
  echo "pg_restore --list accepted a truncated archive, so the documented pre-check does not protect anything." >&2
  exit 1
fi
echo "    pg_restore --list rejected it, which is the check the restore page runs first"

echo "==> Asserting a restore into a populated database replaces rather than merges"
compose_psql "${TARGET_DB}" -c \
  $'INSERT INTO "Workspace" ("id", "name", "createdAt") VALUES (\'ws_stale\', \'Stale\', \'2026-01-01\');' >/dev/null
"${COMPOSE[@]}" exec -T postgres pg_restore --username "${PGUSER_NAME}" --dbname "${TARGET_DB}" \
  --clean --if-exists --no-owner --exit-on-error <"${ARCHIVE}"
fingerprint "${TARGET_DB}" >"${WORK}/target-replaced.txt"
diff -u "${WORK}/source.txt" "${WORK}/target-replaced.txt" ||
  { echo "A restore over existing rows merged instead of replacing." >&2; exit 1; }
echo "    the stale row is gone and the fingerprint matches the source"

echo "==> Asserting the shipped script refuses a deployment it cannot locate"
SCRIPT="${REPO_DIR}/scripts/asobeast-backup.sh"
ELSEWHERE="${WORK}/elsewhere"
SCRIPT_ROOT="${WORK}/backups"
mkdir -p "${ELSEWHERE}"

script_backup() {
  (cd "${ELSEWHERE}" && env \
    BACKUP_ROOT="${SCRIPT_ROOT}" \
    BACKUP_DATABASE="${SOURCE_DB}" \
    BACKUP_USER="${PGUSER_NAME}" \
    "$@" \
    bash "${SCRIPT}")
}

if script_backup COMPOSE_FILE= >"${WORK}/no-compose-file.txt" 2>&1; then
  echo "The shipped script succeeded without COMPOSE_FILE, so a scheduled run would still guess at the deployment." >&2
  exit 1
fi
grep --quiet "COMPOSE_FILE is required" "${WORK}/no-compose-file.txt" ||
  { echo "The shipped script failed without naming COMPOSE_FILE as the reason:"; cat "${WORK}/no-compose-file.txt"; exit 1; }

if script_backup COMPOSE_FILE=docker-compose.dev.yml >"${WORK}/relative-compose-file.txt" 2>&1; then
  echo "The shipped script accepted a relative COMPOSE_FILE, which resolves against whatever directory the scheduler used." >&2
  exit 1
fi
grep --quiet "must list absolute paths" "${WORK}/relative-compose-file.txt" ||
  { echo "The shipped script rejected a relative COMPOSE_FILE without saying why:"; cat "${WORK}/relative-compose-file.txt"; exit 1; }

test ! -e "${SCRIPT_ROOT}" ||
  { echo "The shipped script created ${SCRIPT_ROOT} before it knew where the deployment was." >&2; exit 1; }
echo "    it names the missing setting and writes nothing"

echo "==> Taking a backup with the shipped script from outside the repository"
script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" >"${WORK}/script-run.txt"
SCRIPT_ARCHIVE="$(head -n 1 "${WORK}/script-run.txt")"
test -s "${SCRIPT_ARCHIVE}" ||
  { echo "The shipped script reported ${SCRIPT_ARCHIVE}, which is missing or empty:"; cat "${WORK}/script-run.txt"; exit 1; }
case "${SCRIPT_ARCHIVE}" in
  "${SCRIPT_ROOT}/daily/"*) ;;
  *)
    echo "The shipped script wrote ${SCRIPT_ARCHIVE} outside the daily generation under ${SCRIPT_ROOT}." >&2
    exit 1
    ;;
esac
test -z "$(find "${SCRIPT_ROOT}" -name '*.partial')" ||
  { echo "The shipped script left a partial archive behind." >&2; exit 1; }
echo "    archive $(wc -c <"${SCRIPT_ARCHIVE}" | tr -d ' ') bytes at ${SCRIPT_ARCHIVE}"

echo "==> Restoring the archive the shipped script produced"
SCRIPT_DB="${TARGET_DB}_script"
recreate_database "${SCRIPT_DB}"
"${COMPOSE[@]}" exec -T postgres pg_restore --username "${PGUSER_NAME}" --dbname "${SCRIPT_DB}" \
  --clean --if-exists --no-owner --exit-on-error <"${SCRIPT_ARCHIVE}"
fingerprint "${SCRIPT_DB}" >"${WORK}/target-script.txt"
diff -u "${WORK}/source.txt" "${WORK}/target-script.txt" ||
  { echo "The archive the scheduled script produces does not restore to the source." >&2; exit 1; }
echo "    it restores to the same fingerprint as the source"

echo "==> Asserting the shipped script accepts the compose file list Compose accepts"
printf 'name: asobeast-dev\n' >"${WORK}/override.yml"
sleep 1
script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml:${WORK}/override.yml" \
  >"${WORK}/script-override.txt"
test -s "$(head -n 1 "${WORK}/script-override.txt")" ||
  { echo "The shipped script produced no archive from a two file COMPOSE_FILE:"; cat "${WORK}/script-override.txt"; exit 1; }
echo "    an override alongside the base file still reaches the deployment"

echo "==> Asserting the shipped script prunes to its retention window"
sleep 1
BACKUP_KEEP_DAILY=1 script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" \
  >"${WORK}/script-prune.txt"
DAILY_KEPT="$(find "${SCRIPT_ROOT}/daily" -name 'asobeast-*.dump' | wc -l | tr -d ' ')"
test "${DAILY_KEPT}" -eq 1 ||
  { echo "The shipped script kept ${DAILY_KEPT} daily archives at BACKUP_KEEP_DAILY=1."; cat "${WORK}/script-prune.txt"; exit 1; }
echo "    one daily archive kept, the older one pruned"

echo "==> Asserting an archive that left the host restores from the remote alone"
for tool in age age-keygen rclone; do
  command -v "${tool}" >/dev/null 2>&1 ||
    { echo "${tool} is required to drill the offsite copy." >&2; exit 1; }
done

OFFSITE_DIR="${WORK}/offsite"
mkdir -p "${OFFSITE_DIR}"
age-keygen -o "${OFFSITE_DIR}/identity.txt" 2>/dev/null
age-keygen -o "${OFFSITE_DIR}/stranger.txt" 2>/dev/null
OFFSITE_RECIPIENT="$(sed -n 's/^# public key: //p' "${OFFSITE_DIR}/identity.txt")"
OFFSITE_REMOTE="${BACKUP_DRILL_REMOTE:-${WORK}/remote}"
rclone mkdir -- "${OFFSITE_REMOTE}" >/dev/null

echo "==> Asserting the shipped script refuses to push an unencrypted archive"
if script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" \
  BACKUP_REMOTE="${OFFSITE_REMOTE}" >"${WORK}/offsite-plaintext.txt" 2>&1; then
  echo "The shipped script pushed an archive offsite with no recipient configured." >&2
  exit 1
fi
grep --quiet "BACKUP_AGE_RECIPIENT is not" "${WORK}/offsite-plaintext.txt" ||
  { echo "The shipped script refused the push without naming the missing recipient:"; cat "${WORK}/offsite-plaintext.txt"; exit 1; }
test -z "$(rclone lsf --files-only --recursive -- "${OFFSITE_REMOTE}")" ||
  { echo "The refused run still left something in the remote." >&2; exit 1; }
echo "    it names the missing recipient and uploads nothing"

sleep 1
script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" \
  BACKUP_AGE_RECIPIENT="${OFFSITE_RECIPIENT}" \
  BACKUP_REMOTE="${OFFSITE_REMOTE}" >"${WORK}/offsite-run.txt"
cat "${WORK}/offsite-run.txt"

REMOTE_OBJECT="$(rclone lsf --files-only -- "${OFFSITE_REMOTE}/daily" | sort -r | head -n 1)"
test -n "${REMOTE_OBJECT}" ||
  { echo "The run reported success but the remote holds no daily object." >&2; exit 1; }
case "${REMOTE_OBJECT}" in
  *.dump.age) ;;
  *)
    echo "The remote holds ${REMOTE_OBJECT}, which is not an encrypted archive." >&2
    exit 1
    ;;
esac
test -z "$(rclone lsf --files-only --recursive -- "${OFFSITE_REMOTE}" | grep -v '\.age$')" ||
  { echo "The remote holds an object that is not encrypted." >&2; exit 1; }
test -z "$(find "${SCRIPT_ROOT}" -name '*.age')" ||
  { echo "The uploaded copy was left on the host, so this drill could read it instead of fetching." >&2; exit 1; }
echo "    ${REMOTE_OBJECT} is offsite, encrypted, and no longer on the host"

echo "==> Fetching the archive back from the remote"
rclone copyto -- "${OFFSITE_REMOTE}/daily/${REMOTE_OBJECT}" "${OFFSITE_DIR}/fetched.dump.age"
test -s "${OFFSITE_DIR}/fetched.dump.age"

if age --decrypt --identity "${OFFSITE_DIR}/stranger.txt" \
  --output /dev/null -- "${OFFSITE_DIR}/fetched.dump.age" 2>/dev/null; then
  echo "The offsite archive decrypted with a key it was not encrypted to." >&2
  exit 1
fi
echo "    a key it was not encrypted to cannot read it"

age --decrypt --identity "${OFFSITE_DIR}/identity.txt" \
  --output "${OFFSITE_DIR}/fetched.dump" -- "${OFFSITE_DIR}/fetched.dump.age"
"${COMPOSE[@]}" exec -T postgres pg_restore --list <"${OFFSITE_DIR}/fetched.dump" >/dev/null

echo "==> Restoring the fetched archive"
OFFSITE_DB="${TARGET_DB}_offsite"
recreate_database "${OFFSITE_DB}"
"${COMPOSE[@]}" exec -T postgres pg_restore --username "${PGUSER_NAME}" --dbname "${OFFSITE_DB}" \
  --clean --if-exists --no-owner --exit-on-error <"${OFFSITE_DIR}/fetched.dump"
fingerprint "${OFFSITE_DB}" >"${WORK}/target-offsite.txt"
diff -u "${WORK}/source.txt" "${WORK}/target-offsite.txt" ||
  { echo "The archive fetched off the host does not restore to the source." >&2; exit 1; }
echo "    it restores to the same fingerprint as the source"

echo "==> Asserting the remote prunes to its own window"
sleep 1
script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" \
  BACKUP_AGE_RECIPIENT="${OFFSITE_RECIPIENT}" \
  BACKUP_REMOTE="${OFFSITE_REMOTE}" \
  BACKUP_REMOTE_KEEP_DAILY=1 >"${WORK}/offsite-prune.txt"
REMOTE_KEPT="$(rclone lsf --files-only -- "${OFFSITE_REMOTE}/daily" | wc -l | tr -d ' ')"
test "${REMOTE_KEPT}" -eq 1 ||
  { echo "The remote kept ${REMOTE_KEPT} daily objects at BACKUP_REMOTE_KEEP_DAILY=1."; cat "${WORK}/offsite-prune.txt"; exit 1; }
echo "    one daily object kept offsite, the older one deleted"

echo "==> Asserting the run reports its completion where the api reads it"
DRILL_REDIS_DB="${BACKUP_DRILL_REDIS_DB:-9}"
"${COMPOSE[@]}" exec -T redis redis-cli -n "${DRILL_REDIS_DB}" DEL asobeast:last-backup >/dev/null
sleep 1
script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" \
  BACKUP_AGE_RECIPIENT="${OFFSITE_RECIPIENT}" \
  BACKUP_REMOTE="${OFFSITE_REMOTE}" \
  BACKUP_REDIS_DB="${DRILL_REDIS_DB}" >"${WORK}/offsite-report.txt"
REPORTED="$(sed -n 's/^reported asobeast:last-backup=//p' "${WORK}/offsite-report.txt")"
test -n "${REPORTED}" ||
  { echo "The run did not report a completion time:"; cat "${WORK}/offsite-report.txt"; exit 1; }
RECORDED="$("${COMPOSE[@]}" exec -T redis redis-cli -n "${DRILL_REDIS_DB}" \
  GET asobeast:last-backup | tr -d '\r')"
test "${RECORDED}" = "${REPORTED}" ||
  { echo "The run reported ${REPORTED} but redis holds \"${RECORDED}\"." >&2; exit 1; }
echo "    redis holds ${RECORDED}, which is what the freshness alert reads"

echo "==> Asserting a failed run reports no completion"
"${COMPOSE[@]}" exec -T redis redis-cli -n "${DRILL_REDIS_DB}" DEL asobeast:last-backup >/dev/null
if script_backup COMPOSE_FILE="${REPO_DIR}/docker-compose.dev.yml" \
  BACKUP_AGE_RECIPIENT="${OFFSITE_RECIPIENT}" \
  BACKUP_REMOTE="/nonexistent-remote-root/asobeast" \
  BACKUP_RCLONE=/nonexistent/rclone \
  BACKUP_REDIS_DB="${DRILL_REDIS_DB}" >"${WORK}/offsite-failed.txt" 2>&1; then
  echo "A run with no way to reach the remote reported success." >&2
  exit 1
fi
test -z "$("${COMPOSE[@]}" exec -T redis redis-cli -n "${DRILL_REDIS_DB}" \
  GET asobeast:last-backup | tr -d '\r')" ||
  { echo "A failed run still reported a completed backup." >&2; exit 1; }
echo "    a run that could not finish leaves the freshness signal alone"

echo "==> Asserting an older archive restores and migrates forward"
BASELINE_TAG="${UPGRADE_FROM_TAG:-v1.0.0}"
BASELINE_SHA="$(git -C "${REPO_DIR}" rev-parse --verify --quiet "${BASELINE_TAG}^{commit}" || true)"
if [ -z "${BASELINE_SHA}" ] || [ "${BASELINE_SHA}" = "$(git -C "${REPO_DIR}" rev-parse --verify HEAD)" ]; then
  if [ -n "${UPGRADE_DRILL_REQUIRE_TAG:-}" ]; then
    echo "BASELINE_TAG ${BASELINE_TAG} does not resolve to an earlier commit and the drill was required." >&2
    exit 1
  fi
  echo "    skipped: ${BASELINE_TAG} is not an earlier release, so there is no older archive to restore"
else
BASELINE_DB="${SOURCE_DB}_baseline"
BASELINE_WORK="${WORK}/baseline"
mkdir -p "${BASELINE_WORK}"
git -C "${REPO_DIR}" archive "${BASELINE_TAG}" apps/api/prisma/migrations | tar -x -C "${BASELINE_WORK}"
git -C "${REPO_DIR}" show "${BASELINE_TAG}:apps/api/prisma/schema.prisma" \
  >"${BASELINE_WORK}/apps/api/prisma/schema.prisma"
cat >"${WORK}/baseline.config.ts" <<EOF
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '${BASELINE_WORK}/apps/api/prisma/schema.prisma',
  migrations: { path: '${BASELINE_WORK}/apps/api/prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
EOF

recreate_database "${BASELINE_DB}"
(cd "${API_DIR}" && DATABASE_URL="postgresql://${PGUSER_NAME}:${PGUSER_NAME}@localhost:5433/${BASELINE_DB}" \
  pnpm exec prisma migrate deploy --config "${WORK}/baseline.config.ts" >/dev/null)
compose_psql "${BASELINE_DB}" <"${FIXTURE}" >/dev/null
"${COMPOSE[@]}" exec -T postgres pg_dump --username "${PGUSER_NAME}" --dbname "${BASELINE_DB}" \
  --format=custom >"${WORK}/baseline.dump"

recreate_database "${TARGET_DB}"
"${COMPOSE[@]}" exec -T postgres pg_restore --username "${PGUSER_NAME}" --dbname "${TARGET_DB}" \
  --clean --if-exists --no-owner --exit-on-error <"${WORK}/baseline.dump"
(cd "${API_DIR}" && DATABASE_URL="postgresql://${PGUSER_NAME}:${PGUSER_NAME}@localhost:5433/${TARGET_DB}" \
  pnpm exec prisma migrate deploy >/dev/null)
fingerprint "${TARGET_DB}" >"${WORK}/target-migrated.txt"
diff -u "${WORK}/source.txt" "${WORK}/target-migrated.txt" ||
  { echo "Restoring a ${BASELINE_TAG} archive and migrating forward changed the data." >&2; exit 1; }
echo "    a ${BASELINE_TAG} archive restored onto the current image and migrated cleanly"
fi

echo "==> Booting the api against the restored database"
DATABASE_URL="postgresql://${PGUSER_NAME}:${PGUSER_NAME}@localhost:5433/${TARGET_DB}" \
  UPGRADE_BOOT_PORT="${BACKUP_BOOT_PORT:-4320}" \
  UPGRADE_REDIS_DB="${BACKUP_REDIS_DB:-8}" \
  "${API_DIR}/test/upgrade/verify-boot.sh"

echo "==> Backup and restore drill passed"
