#!/usr/bin/env bash
# Bring a Claude Code cloud session to the state the working tree expects:
# services running, dependencies installed, database migrated.
#
# Wired to the SessionStart hook in .claude/settings.json, so it also runs on a
# laptop. The CLAUDE_CODE_REMOTE guard below is what keeps it from touching a
# local checkout, where the developer owns their own stack.
#
# Every step is idempotent, because the hook runs again on every resume.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${root}"

step() { echo "==> $*"; }

# The setup script installs Node 24 to match CI and both Dockerfiles. Say so out
# loud when it did not take, because a suite that passes here on the image's
# older Node and then fails in the pipeline is the failure worth naming early.
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${node_major}" != "24" ]; then
  echo "This session runs Node $(node --version 2>/dev/null || echo 'unknown') but CI runs 24." >&2
  echo "Re-run scripts/cloud/setup.sh as the environment's setup script, or prepend /opt/node24/bin to PATH if it is already installed." >&2
fi

# The sandbox ships dockerd but does not run it, and Compose is how this
# repository gets Postgres 18 and Redis 8 rather than the older pair installed
# on the image.
start_docker() {
  docker info >/dev/null 2>&1 && return 0

  step "starting dockerd"
  # mktemp rather than a fixed path: a redirect onto a name something else
  # created first follows it wherever it points. The Xs go last because
  # busybox mktemp rejects a template with a suffix after them.
  local log
  log="$(mktemp /tmp/dockerd.XXXXXX)"
  service docker start >/dev/null 2>&1 ||
    (dockerd >"${log}" 2>&1 &)

  local waited=0
  until docker info >/dev/null 2>&1; do
    if [ "${waited}" -ge 60 ]; then
      echo "dockerd did not accept connections within 60 seconds. See ${log}." >&2
      echo "Postgres and Redis come from docker-compose.dev.yml, so nothing that touches the database will work until it starts." >&2
      return 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
}

start_docker

step "writing development .env files"
scripts/dev-env.sh

step "starting postgres and redis"
docker compose -f docker-compose.dev.yml up -d --wait

step "installing dependencies"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

step "generating the prisma client"
pnpm --filter api exec prisma generate

step "applying migrations"
pnpm --filter api run db:deploy

step "ready: pnpm lint, pnpm test and pnpm build all run from here"
