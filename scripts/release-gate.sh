#!/usr/bin/env bash
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"

version_at() {
  git show "$1:packages/$2/package.json" | node -p 'JSON.parse(require("node:fs").readFileSync(0, "utf8")).version'
}

access_of() {
  node -p "JSON.parse(require('node:fs').readFileSync('packages/$1/package.json', 'utf8')).publishConfig.access"
}

finish() {
  {
    echo "release=$1"
    echo "sha=$2"
    echo "version=$3"
  } >> "$out"
  exit 0
}

no_release() {
  echo "no release: $1"
  echo "release=false" >> "$out"
  exit 0
}

fail() {
  echo "::error::$1"
  exit 1
}

core="$(version_at HEAD core)"
react="$(version_at HEAD react)"

[ "$core" = "$react" ] || fail "fixed group out of step: core $core, react $react"

if [ "${REHEARSE:-false}" = "true" ]; then
  echo "rehearsal: pack $core at $(git rev-parse HEAD), publish nothing"
  finish false "$(git rev-parse HEAD)" "$core"
fi

[ "$core" != "0.0.0" ] || no_release "0.0.0 is the unreleased placeholder"

if [ "${GITHUB_EVENT_NAME:-push}" = "push" ]; then
  [ "$(version_at HEAD^ core)" != "$core" ] || no_release "$core did not change in this commit"
  sha="$(git rev-parse HEAD)"

  pull="$(gh api "repos/$GITHUB_REPOSITORY/commits/$sha/pulls" --jq '.[0] | "\(.head.ref) \(.head.sha)"')"
  ref="${pull%% *}"
  head="${pull##* }"
  [ "$ref" = "release/$core" ] || fail "$core must land from a release/$core pull request, found '$ref'"

  ci="$(gh api "repos/$GITHUB_REPOSITORY/commits/$head/check-runs?check_name=ci" --jq '.check_runs[0].conclusion')"
  [ "$ci" = "success" ] || fail "ci on $head is '$ci'. Fix it, then run the release workflow by hand"
else
  sha="$(git log -1 --format=%H -G'"version":' -- packages/core/package.json)"
fi

for package in core react; do
  if [ "${REPO_PRIVATE:-true}" = "true" ] && [ "$(access_of "$package")" = "public" ]; then
    fail "the repo is private but @zriz/$package has publishConfig.access public. A public package is visible to everyone at once. Set it to restricted or make the repo public first"
  fi
done

entry_date="$(VERSION="$core" node --input-type=module -e '
const { RELEASES } = await import(`${process.cwd()}/apps/docs/content/releases.ts`);
console.log(RELEASES.find((entry) => entry.version === process.env.VERSION)?.date ?? "");
')"
[ -n "$entry_date" ] || fail "no changelog entry for $core"

today="$(date -u +%F)"
if [ "$entry_date" != "$today" ]; then
  echo "::warning::changelog says $entry_date for $core, today is $today"
fi

finish true "$sha" "$core"
