#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
problems=()

[ "$(git branch --show-current)" = "main" ] || problems+=("not on main")
[ -z "$(git status --porcelain)" ] || problems+=("working tree is not clean")

git fetch --quiet origin main --tags
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || problems+=("main is not level with origin/main")

[ "$(gh api user --jq .login)" = "pqoqubbw" ] || problems+=("gh is not logged in as pqoqubbw")

open="$(gh pr list --state open --json headRefName --jq '[.[] | select(.headRefName | startswith("release/"))] | map(.headRefName) | join(" ")')"
[ -z "$open" ] || problems+=("open release pull request: $open")

if [ -n "$version" ]; then
  if git ls-remote --exit-code --tags origin "v$version" > /dev/null; then
    problems+=("tag v$version exists on origin")
  fi
  for package in core react; do
    if (cd "packages/$package" && npm view "@zriz/$package@$version" version 2> /dev/null | grep -qx "$version"); then
      problems+=("@zriz/$package@$version is already on npm")
    fi
  done
fi

if [ "${#problems[@]}" -gt 0 ]; then
  printf 'blocked: %s\n' "${problems[@]}"
  exit 1
fi

echo "preflight clean"
