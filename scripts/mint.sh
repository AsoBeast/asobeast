#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../docs"

exec npx --yes "mint@${MINT_VERSION:-4}" "$@"
