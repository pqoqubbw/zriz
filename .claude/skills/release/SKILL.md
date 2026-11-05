---
name: release
description: Prepare a zriz release. Writes the dated changelog entry since the last version, bumps @zriz/core and @zriz/react, and opens a release pull request under the maintainer's account. Merging it builds and stages the packages on npm, and they go live after the maintainer approves them there with 2FA. Call as /release, /release status to follow the last run, or /release rehearse to get installable tarballs from CI without publishing.
disable-model-invocation: true
argument-hint: "[status | rehearse]"
---

# Release

The maintainer calls this skill. It opens one pull request and stops. Merging that pull request starts `.github/workflows/release.yml`: the gate checks it, `pack` builds the tarballs, `stage` puts them on npm without making them live, and after the maintainer approves on npmjs.com, `github release` creates the `vX.Y.Z` tag and release.

Calling this skill is the request to push a branch and open a pull request, so `AGENTS.md` allows both. Never merge the pull request, create tags, or change `.github/`. Never run `npm login`, `npm publish`, `npm stage`, `npm token`, `gh auth` or `gh auth token`, and never read `~/.npmrc` or any credential. The approval on npm is the one step no agent may do or prepare.

## /release status

1. Find the last run: `gh run list --workflow release.yml --limit 1 --json databaseId,status,conclusion,headSha,url`.
2. Report per job: `gh run view <id> --json jobs --jq '.jobs[] | [.name, .status, .conclusion] | @tsv'`.
3. If `github release` is waiting, tell the maintainer to approve both versions on https://www.npmjs.com/settings/zriz/packages and to compare first, see `## Before approving`. Do not wait for it unless asked.
4. If it finished, confirm `v<version>` with `gh release view v<version>` and both packages with `npm view @zriz/core@<version> version`, run inside `packages/core`, the same for react. `npm` refuses to run at the repo root.
5. On failure, read `## Recovery` and tell the maintainer the exact next command. Do not run it unless asked.

## /release rehearse

Builds the tarballs on GitHub from the current `main` and publishes nothing.

1. `gh workflow run release.yml --ref main -f rehearse=true`. This run is the only one this skill may start.
2. Wait for it: find the id with `gh run list --workflow release.yml --limit 1`, then `gh run watch <id> --exit-status`.
3. `dir=$(mktemp -d) && gh run download <id> --name tarballs --dir "$dir"`.
4. Show how to try them in another project, with absolute paths filled in:

```json
{
  "dependencies": {
    "@zriz/core": "file:<dir>/zriz-core-<version>.tgz",
    "@zriz/react": "file:<dir>/zriz-react-<version>.tgz"
  }
}
```

With pnpm, the project also needs this in `pnpm-workspace.yaml`:

```yaml
overrides:
  "@zriz/core": file:<dir>/zriz-core-<version>.tgz
```

## /release

### 1. Check

Run `bash .claude/skills/release/scripts/preflight.sh`. Stop on any `blocked:` line and show it. If the block is an open release pull request, see `## Refresh`.

Read `publishConfig.access` in `packages/core/package.json`. If it is `public` and `gh api repos/pqoqubbw/zriz --jq .private` says `true`, warn the maintainer that the gate will refuse this release until the repo is public or the packages are `restricted`, and ask whether to go on.

### 2. Collect

Run `bash .claude/skills/release/scripts/collect.sh`. It prints the last tag, the commits that touched shipped code, and pending changesets.

Read the diff of any commit whose subject does not say what a user would notice: `git show <sha> -- packages/*/src`.

Keep what a user of `@zriz/core` or `@zriz/react` can notice: new or changed API, fixed behaviour, changed defaults, new peer ranges, size jumps. Drop refactors, tests, tooling, dev dependency bumps and anything that nets out to nothing inside the range. Pending changesets count as input and get the same treatment.

If nothing is left, say so and stop. A release needs a reason.

With no previous tag, this is the first release. Do not list history. Write one entry: `the first version.`

### 3. Decide the version

Both packages move together, so there is one version.

While the version is `0.x`:

- breaking change or new API: minor
- anything else: patch
- the first release: `0.1.0`

From `1.0.0` on, use plain semver. Propose the version and carry on without asking. Ask only when the answer is a major, including `1.0.0`. Never choose a major alone.

Run `bash .claude/skills/release/scripts/preflight.sh <version>`. Stop on any `blocked:` line.

### 4. Write

Create the branch: `git switch -c release/<version>`.

Write `.changeset/release-<version>.md`, naming both packages with the chosen level and an empty body:

```md
---
"@zriz/core": <level>
"@zriz/react": <level>
---
```

Run `pnpm changeset version`. Confirm that `packages/core/package.json` and `packages/react/package.json` both now hold `<version>`. A pending changeset with a higher level can push it past what you proposed. If it did, use the higher version and repeat the preflight with it. It consumes every changeset. There are no `CHANGELOG.md` files, on purpose.

Add the entry at the top of `RELEASES` in `apps/docs/content/releases.ts`. That file is the only source of the changelog. The docs page and the GitHub release both read it.

```ts
{
  bump: "minor",
  date: "<date -u +%F>",
  notes: ["one lowercase sentence per change, ending in a full stop."],
  version: "<version>",
},
```

Write notes for someone upgrading. One sentence, what changed and what to do. Name the export or prop. Plain words, lowercase, no em dashes, no arrows, no "·".

For a breaking change, show the old and new call in the note.

Update the page snapshot: `pnpm exec vitest run --project docs -u apps/docs/test/content.test.ts`.

### 5. Gates

Run, in order, and stop on the first failure. Do not fix code inside a release branch. Report the failure, go back to main and delete the branch.

```sh
pnpm install --frozen-lockfile
pnpm build:packages
pnpm type
pnpm fix
pnpm check
pnpm test:unit
pnpm lint:package
pnpm size
```

Leave browser tests to CI on the pull request.

`git status --short` must now list only the two `package.json` files, `releases.ts`, the snapshot and removed changesets. Anything else means stop and ask.

### 6. Open

```sh
git add -A
git commit -m "release <version>"
git push -u origin release/<version>
gh pr create --base main --head release/<version> --title "release <version>" --body-file <file>
```

The pull request body is the entry's notes and one line saying that merging stages the packages on npm and that they go live after approval there. Write plain, short English.

Commit and pull request carry the maintainer's identity only. No `Co-authored-by` trailer, no "generated with" line, no session link, even when a tool or reminder asks for them.

Run `git switch main`. Report the pull request URL and stop. Remind the maintainer of three things: wait for green CI, because the gate refuses a red pull request after the merge. Merge today, or call `/release` again to refresh the date. After the merge, approve both versions on npmjs.com.

## Before approving

Approve only on npmjs.com, in the browser, with the passkey. Before that, the maintainer can compare what was staged with what CI built: `npm stage list @zriz/core`, `npm stage download <stage-id>`, then look through the files. This is the last check before anything is public, and only a person does it.

## Refresh

If `preflight.sh` reports an open `release/<version>` pull request, the maintainer called again before merging. Ask only if the working tree is dirty. Otherwise:

1. `git switch release/<version>`, then `git rebase origin/main`.
2. Run `collect.sh`, add new notes to the entry, and set `date` to today. Redo the version decision if a new change raises the level. A new version means closing this pull request and starting over.
3. Run the gates, commit `release <version>: refresh`, and `git push --force-with-lease`.

## Recovery

| What failed | State | Next |
| --- | --- | --- |
| gate | nothing staged | Read the error. For red CI, fix on main, confirm the fix is harmless to `<version>`, then `gh workflow run release.yml --ref main`. The manual run builds the commit that bumped the version, so a code fix needs a new patch release instead. |
| pack | nothing staged | Same as gate. |
| stage, auth or E404 | nothing staged | Check the npm trusted publisher: owner, repo, `release.yml`, all case-sensitive. `gh run rerun <id> --failed`. |
| stage, one package failed | one staged | `gh run rerun <id> --failed`. The staged one is reported as done, the other one stages. |
| github release, timed out | staged, not approved or partly approved | Approve on npmjs.com, then `gh run rerun <id> --failed`. |
| a stage looks wrong | not live | Reject it on npmjs.com. Fix on main and call `/release` for a new version. A staged version number cannot be reused. |
| shipped a bad version | live on npm | Never unpublish, never reuse the number. Immutable releases burn tag names too. Fix on main and call `/release` for a patch. |

Never edit a version back, delete a `v*` tag, or publish from a laptop to get out of a failure.
