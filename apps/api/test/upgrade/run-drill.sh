#!/usr/bin/env bash
set -euo pipefail

UPGRADE_FROM_TAG="${UPGRADE_FROM_TAG:-v1.0.0}"

DRILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${DRILL_DIR}/../.." && pwd)"
REPO_DIR="$(cd "${API_DIR}/../.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [[ "${DATABASE_URL%%\?*}" != *_upgrade ]]; then
  echo "DATABASE_URL must name a database ending in _upgrade. This script drops the public schema." >&2
  exit 1
fi

if ! BASELINE_SHA="$(git -C "${REPO_DIR}" rev-parse --verify --quiet "${UPGRADE_FROM_TAG}^{commit}")"; then
  if [ -n "${UPGRADE_DRILL_REQUIRE_TAG:-}" ]; then
    echo "UPGRADE_FROM_TAG ${UPGRADE_FROM_TAG} does not resolve and the drill was required. Fetch the tags with a full checkout." >&2
    exit 1
  fi
  echo "==> Skipping: ${UPGRADE_FROM_TAG} is not tagged yet. Nothing has been released to upgrade from."
  exit 0
fi

if [ "${BASELINE_SHA}" = "$(git -C "${REPO_DIR}" rev-parse --verify HEAD)" ]; then
  if [ -n "${UPGRADE_DRILL_REQUIRE_TAG:-}" ]; then
    echo "UPGRADE_FROM_TAG ${UPGRADE_FROM_TAG} is the current commit and the drill was required. Bump the baseline." >&2
    exit 1
  fi
  echo "==> Skipping: ${UPGRADE_FROM_TAG} is the current commit, so there are no migrations to apply on top of it."
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

BASELINE_DIR="${WORK}/baseline"
COUNTS_BEFORE="${WORK}/counts-before.txt"
COUNTS_AFTER="${WORK}/counts-after.txt"

run_sql() {
  psql "${DATABASE_URL}" --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$@"
}

capture_counts() {
  run_sql --tuples-only --no-align --field-separator=' ' <<'SQL'
SELECT 'Workspace', count(*) FROM "Workspace"
UNION ALL SELECT 'User', count(*) FROM "User"
UNION ALL SELECT 'ApiToken', count(*) FROM "ApiToken"
UNION ALL SELECT 'AppGroup', count(*) FROM "AppGroup"
UNION ALL SELECT 'App', count(*) FROM "App"
UNION ALL SELECT 'AppSnapshot', count(*) FROM "AppSnapshot"
UNION ALL SELECT 'Keyword', count(*) FROM "Keyword"
UNION ALL SELECT 'TrackedKeyword', count(*) FROM "TrackedKeyword"
UNION ALL SELECT 'KeywordMetric', count(*) FROM "KeywordMetric"
UNION ALL SELECT 'KeywordRanking', count(*) FROM "KeywordRanking"
UNION ALL SELECT 'CategoryRank', count(*) FROM "CategoryRank"
UNION ALL SELECT 'SerpEntry', count(*) FROM "SerpEntry"
UNION ALL SELECT 'ChangeEvent', count(*) FROM "ChangeEvent"
UNION ALL SELECT 'Review', count(*) FROM "Review"
UNION ALL SELECT 'SuggestProbe', count(*) FROM "SuggestProbe"
UNION ALL SELECT 'AuditInsight', count(*) FROM "AuditInsight"
UNION ALL SELECT 'AuditScore', count(*) FROM "AuditScore"
UNION ALL SELECT 'Webhook', count(*) FROM "Webhook"
UNION ALL SELECT 'EmailAlert', count(*) FROM "EmailAlert"
UNION ALL SELECT 'AlertDelivery', count(*) FROM "AlertDelivery"
UNION ALL SELECT 'AlertEvent', count(*) FROM "AlertEvent"
ORDER BY 1;
SQL
}

echo "==> Resetting ${DATABASE_URL%%\?*}"
run_sql -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' >/dev/null

echo "==> Exporting the ${UPGRADE_FROM_TAG} migrations"
mkdir -p "${BASELINE_DIR}"
git -C "${REPO_DIR}" archive "${UPGRADE_FROM_TAG}" apps/api/prisma/migrations | tar -x -C "${BASELINE_DIR}"
git -C "${REPO_DIR}" show "${UPGRADE_FROM_TAG}:apps/api/prisma/schema.prisma" \
  >"${BASELINE_DIR}/apps/api/prisma/schema.prisma"

cat >"${WORK}/baseline.config.ts" <<EOF
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '${BASELINE_DIR}/apps/api/prisma/schema.prisma',
  migrations: { path: '${BASELINE_DIR}/apps/api/prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
EOF

echo "==> Applying the ${UPGRADE_FROM_TAG} migrations"
(cd "${API_DIR}" && pnpm exec prisma migrate deploy --config "${WORK}/baseline.config.ts")

echo "==> Loading the ${UPGRADE_FROM_TAG} fixture"
run_sql -f "${DRILL_DIR}/fixture-baseline.sql" >/dev/null

capture_counts >"${COUNTS_BEFORE}"
echo "==> Captured ${UPGRADE_FROM_TAG} row counts"
cat "${COUNTS_BEFORE}"

echo "==> Applying the migrations added since ${UPGRADE_FROM_TAG}"
(cd "${API_DIR}" && pnpm exec prisma migrate deploy)

echo "==> Asserting the migration state is up to date"
(cd "${API_DIR}" && pnpm exec prisma migrate status)

echo "==> Asserting the migrations reproduce the schema"
(cd "${API_DIR}" && pnpm exec prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --exit-code)

capture_counts >"${COUNTS_AFTER}"
echo "==> Captured upgraded row counts"
cat "${COUNTS_AFTER}"

if ! diff -u "${COUNTS_BEFORE}" "${COUNTS_AFTER}"; then
  echo "The upgrade changed row counts. A migration dropped or duplicated existing data." >&2
  exit 1
fi

echo "==> Upgrade drill passed from ${UPGRADE_FROM_TAG}"
