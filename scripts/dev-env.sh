#!/usr/bin/env bash
# Write the .env files a development stack needs from the committed examples,
# generating the two secrets the examples deliberately leave empty.
#
# Idempotent: a file that already exists is left untouched, so local edits and
# real credentials survive a re-run. Safe to run on a laptop and in a Claude
# Code cloud session, which is what scripts/cloud/session-start.sh does.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is not on PATH, so this script cannot generate AUTH_SECRET or POSTGRES_PASSWORD." >&2
  exit 1
fi

# Replace NAME=... in place, appending the assignment when the file has none.
# awk rather than sed because a generated secret is arbitrary text and awk's
# printf never reinterprets it.
set_var() {
  local file="$1" name="$2" value="$3"
  awk -v name="${name}" -v value="${value}" '
    index($0, name "=") == 1 { printf "%s=%s\n", name, value; found = 1; next }
    { print }
    END { if (!found) printf "%s=%s\n", name, value }
  ' "${file}" >"${file}.tmp"
  mv "${file}.tmp" "${file}"
}

# create <example> <target> [NAME...] — copy the example, then fill each named
# variable with a fresh 32-byte hex secret.
create() {
  local example="$1" target="$2"
  shift 2

  if [ -e "${target}" ]; then
    echo "kept    ${target}"
    return
  fi

  install -m 600 "${example}" "${target}"
  local name
  for name in "$@"; do
    set_var "${target}" "${name}" "$(openssl rand -hex 32)"
  done
  echo "created ${target}"
}

# The root file is read by the Compose stacks; the two app files by pnpm dev and
# by the test suites. AUTH_SECRET differs between them on purpose: nothing shares
# a session across the two stacks, and a development secret is never reused.
create .env.example .env POSTGRES_PASSWORD AUTH_SECRET
create apps/api/.env.example apps/api/.env AUTH_SECRET
create apps/web/.env.example apps/web/.env

cat <<'NOTE'

The generated secrets are for development only. Every one is local to this
checkout, none is committed, and .gitignore keeps them that way.
NOTE
