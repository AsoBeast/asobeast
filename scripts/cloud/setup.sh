#!/usr/bin/env bash
# Setup script for a Claude Code cloud environment.
#
# Paste the contents of this file into the Setup script field at
# claude.ai/code > environment settings. It is committed here so the value in
# that field has a reviewed source, and so a change to it arrives through a pull
# request like everything else.
#
# It runs once per environment, as root, before Claude Code launches; Anthropic
# then snapshots the filesystem and reuses it, so anything installed here is
# already on disk at the start of every later session. Two rules follow from
# that: it must exit zero, or no session starts, and it must finish inside about
# five minutes, or the snapshot never builds. Running processes are not
# snapshotted, which is why starting services belongs in session-start.sh
# instead.
#
# Everything repository-specific — dependencies, Prisma, migrations — lives in
# scripts/cloud/session-start.sh, which runs on every session against the
# checkout as it stands.
set -uo pipefail

NODE_MAJOR=24

# The sandbox image ships Node 20, 21 and 22. CI and both Dockerfiles build on
# 24, so install it rather than let cloud runs disagree with the pipeline about
# the runtime. nodejs.org is on the default allowlist.
install_node() {
  command -v node >/dev/null 2>&1 &&
    [ "$(node -p 'process.versions.node.split(".")[0]')" = "${NODE_MAJOR}" ] &&
    return 0

  # Node names its arm64 build differently from what uname reports, and an
  # image that turns out to be arm64 would otherwise fetch an x64 tarball,
  # fail, and leave the session on the older Node without an obvious reason.
  local arch
  case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) return 1 ;;
  esac

  local version
  version="$(curl -fsSL https://nodejs.org/dist/index.json |
    jq -r --arg major "v${NODE_MAJOR}." '[.[] | select(.version | startswith($major))][0].version')"
  [ -n "${version}" ] && [ "${version}" != "null" ] || return 1

  curl -fsSL "https://nodejs.org/dist/${version}/node-${version}-linux-${arch}.tar.xz" |
    tar -xJ -C /opt || return 1
  rm -rf "/opt/node${NODE_MAJOR}"
  mv "/opt/node-${version}-linux-${arch}" "/opt/node${NODE_MAJOR}"

  # /usr/local/bin is ahead of the image's own Node on PATH, so the symlinks
  # decide which node a plain `node` finds. profile.d covers login shells.
  local binary
  for binary in node npm npx corepack; do
    ln -sf "/opt/node${NODE_MAJOR}/bin/${binary}" "/usr/local/bin/${binary}"
  done
  echo "export PATH=/opt/node${NODE_MAJOR}/bin:\$PATH" >"/etc/profile.d/node${NODE_MAJOR}.sh"
}

install_node || echo "Node ${NODE_MAJOR} did not install; sessions fall back to the image's Node." >&2

# corepack resolves pnpm from the packageManager field in package.json, so the
# version stays pinned in one place instead of being repeated here.
corepack enable || true

# Pre-pull what docker-compose.dev.yml runs. The snapshot keeps the images, so
# no session waits on a pull.
(dockerd >/tmp/dockerd-setup.log 2>&1 &)
for _ in $(seq 1 30); do
  docker info >/dev/null 2>&1 && break
  sleep 2
done
docker pull postgres:18-alpine || true
docker pull redis:8-alpine || true

# A setup script that exits non-zero blocks every session in the environment,
# and none of the work above is worth that.
exit 0
