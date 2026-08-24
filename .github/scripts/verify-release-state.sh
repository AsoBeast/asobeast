#!/usr/bin/env bash
set -euo pipefail

manifest="${MANIFEST_FILE:-.release-please-manifest.json}"
mode="${MODE:-fail}"

if [ ! -f "$manifest" ]; then
  echo "::error::${manifest} not found"
  exit 1
fi

if ! version="$(jq -r '."."' "$manifest" 2>/dev/null)"; then
  echo "::error::${manifest} is not valid JSON"
  exit 1
fi

if [ -z "$version" ] || [ "$version" = "null" ]; then
  echo "::error::${manifest} declares no version under the \".\" key"
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/v${version}" >/dev/null 2>&1; then
  echo "release pipeline healthy, v${version} tagged"
  exit 0
fi

if [ "$mode" = "warn" ]; then
  echo "::warning::manifest declares ${version} with no v${version} tag on origin"
  exit 0
fi

echo "::error::manifest declares ${version} but origin has no v${version} tag"
echo "::error::the release pipeline is wedged, see docs/operations/release-recovery.mdx"
exit 1
