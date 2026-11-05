# zriz

Headless image cropper for React and plain TypeScript with the feel of the crop tool in iOS Photos. A dial straightens the photo, the photo zooms just enough that the crop never shows an empty corner, and the crop box springs back to the centre when you let go.

The pages in `apps/docs/content` are the spec for public behaviour and API. If the code and a page disagree, say so in your answer or PR instead of quietly picking one.

## Layout

- `packages/core`: `@zriz/core`, framework-agnostic TypeScript with zero dependencies. The root entry holds the maths, the store, the frame clock, the decay and velocity helpers and the value format, and their tests run in node. Springs stay internal in `src/motion.ts`. `@zriz/core/dom` holds the binders and handlers behind the parts, image loading and export. Never import React here, never add `"use client"`.
- `packages/react`: `@zriz/react`, unstyled React parts in the style of Base UI. Apps import parts only as `import * as Cropper from "@zriz/react/cropper"`. The root entry exports hooks, helpers and types, never parts. Every file that uses hooks or browser APIs starts with `"use client"`.
- `apps/docs`: the Next.js site for zriz.dev. Each page is typed data in `content/<slug>.ts`, built from the blocks in `lib/doc/define.ts`. One renderer turns it into HTML (`components/doc/blocks.tsx`) and one into markdown for agents (`lib/doc/markdown.ts`); a new block kind fails to compile until both handle it. Code shown on a page lives in `snippets/<slug>/` as real, type-checked files, and excerpts are cut from them by anchor lines. Nav order and titles are in `lib/nav.ts`. Demos are grey placeholders for now.
- `test/react18`: React 18.3 and `@types/react` 18, for the second test run and a consumer type check.
- `scripts/css.ts`: minifies the shared stylesheet and fails the build when it goes over its gzip budget.

## Setup

1. Node from `.nvmrc`. Any version in `engines.node` works. pnpm 10 or newer switches itself to the version in `packageManager`.
2. `pnpm install`
3. `pnpm exec playwright install --only-shell chromium firefox webkit`, once per Playwright version. On Linux, add `--with-deps`.
4. `pnpm build:packages`. Lint, tests and the package type checks resolve `@zriz/core` and `@zriz/react` from `dist`, so build again after you change either package. The docs app and snippets type-check against source.

## Commands

- `pnpm dev` runs the docs on http://localhost:4777 against package source, so edits reload live, except `@zriz/react/warn`, which comes from `dist`. `pnpm dev -p 4800` uses another port. The `PORT` variable has no effect.
- `pnpm check` and `pnpm fix` run ultracite (oxlint type-aware and oxfmt).
- `pnpm type` type-checks every workspace and writes the Next.js route types that `pnpm check` needs. On a fresh clone, run `build:packages`, then `type`, then `check`.
- `pnpm test` runs unit tests in node and browser tests in chromium, firefox and webkit. `pnpm test:unit` skips the browsers.
- `pnpm build:packages`, `pnpm lint:package` (publint and attw), `pnpm size` (size-limit).
- `/release` in Claude Code prepares a release: changelog, version bump and pull request. Only the maintainer runs it. `apps/docs/content/releases.ts` is the only source of the changelog.
- `pnpm sim` opens the docs in a booted iOS simulator. It needs macOS with Xcode. Boot one with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl boot <device>`.

All of check, type, test, lint:package and size must pass before a commit. CI runs the same steps on every pull request.

## Toolchain notes

- The packages use TypeScript 7 with `isolatedDeclarations`, so every export needs an explicit type.
- The docs app stays on TypeScript 5.9, because Next.js type-checks through the TypeScript compiler API, which TypeScript 7 lacks until 7.1.
- The packages build with tsdown in unbundle mode, ESM only, per-file output, so `"use client"` stays on each file. tsdown warns that the directive "may not be preserved". It is preserved; check `dist` if in doubt.
- pnpm refuses releases younger than one day (`minimumReleaseAge`). Pin the previous version instead of turning it off.
- Test files: `*.test.ts` run in node, `*.browser.test.ts` and `*.browser.test.tsx` run in the three browsers. In `apps/docs`, only `.browser.test.tsx` reaches the browsers. Property tests for maths use fast-check.
- The `unit-react18` and `browser-react18` projects run the React tests again on React 18.3, installed in `test/react18`. That folder also type-checks a consumer file against `@types/react` 18.
- For Next.js APIs, read the docs that ship with the installed version in `apps/docs/node_modules/next/dist/docs/`. `next.config.ts` sets `agentRules: false`, so `next dev` never writes its own agent file.

## Rules

- Zero runtime dependencies. `@zriz/core` depends on nothing. `@zriz/react` has `@zriz/core` and `react` 18.2+ as peers, with one build for 18 and 19. Write it ourselves. A new runtime dependency needs a maintainer's yes in an issue first. Dev dependencies are fine.
- Don't add, remove or upgrade dependencies unless the task asks for it. Reviewers read every lockfile change.
- No code comments, TSDoc included. The one exception: a single short line on public props of React parts. API tables are hand-written in `apps/docs/content/<slug>.ts`, so change them there too. Never restate what the code or the name already says.
- Per-frame values never go through React state. Use refs, CSS variables and subscriptions.
- Every rule in the stylesheet sits in `:where()` inside `@layer components.zriz`, so any user class wins.
- Icons in the docs are hand-drawn SVG in `apps/docs/components/ui/icon.tsx`. Don't add an icon library.
- Docs copy in `apps/docs/content` is lowercase, like the pages already there.
- Prose in docs, commit messages and PR text is plain, short English. No em dashes, no arrows, no "·" separators.
- Commit subjects match `git log`: one short lowercase line, with an area prefix such as `docs:` when it helps.
- Check motion by recording it at real frame rate and comparing it with the crop tool in iOS Photos. A still screenshot does not test motion. Attach the recording to the PR.
- Close every browser tab, dev server and simulator you open for testing.

## Agents

These rules hold for every coding agent, whoever runs it.

- Work in the local checkout. Don't push, open or edit pull requests or issues, post comments, publish to npm, or create tags or releases unless the person you work for asks for that step in this session.
- Never add AI attribution: no `Co-authored-by` trailers for tools and no "generated with" lines in commits, PRs, code or docs.
- Don't change CI, release or package manager settings (`.github/`, `.changeset/config.json`, `pnpm-workspace.yaml`, and the `engines`, `devEngines` and `packageManager` fields) unless the task is about them.
- Report security problems the way `.github/SECURITY.md` describes, never in a public issue, PR or commit.
