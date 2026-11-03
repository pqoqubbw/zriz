#!/usr/bin/env bash
set -euo pipefail

last="$(git describe --tags --match 'v[0-9]*' --abbrev=0 2> /dev/null || true)"

if [ -z "$last" ]; then
  echo "last release: none, this is the first release"
  range="HEAD"
else
  echo "last release: $last"
  range="$last..HEAD"
fi

echo
echo "commits that touch shipped code:"
git log --reverse --format='%h %s' "$range" -- packages/core/src packages/react/src packages/core/package.json packages/react/package.json

echo
echo "pending changesets:"
find .changeset -name '*.md' ! -name README.md -print | sort | while read -r file; do
  echo "--- $file"
  cat "$file"
done
