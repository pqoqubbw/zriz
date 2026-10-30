# zriz

Headless image cropper for the web with the feel of iOS Photos. Read `notes/BRIEF.md` for the product, the evidence and the plan, and `notes/SPEC.md` for the feature spec. `notes/` is local only and never committed.

## Layout

- `packages/core`: `@zriz/core`, framework-agnostic TypeScript with zero dependencies. Geometry, the coverage solver, springs, export. Never import React here, never add `"use client"`.
- `packages/react`: `@zriz/react`, unstyled React parts in the style of Base UI. Every file that uses hooks or browser APIs starts with `"use client"`.
- `apps/docs`: the Next.js site for zriz.dev. MDX pages in `content/`, live demos in `demos/<page>/<name>.tsx`, API tables generated from TSDoc in the package source.
- `notes/reference/`: the approved vanilla sketch of the feel and the raw research. Read only, local only.

## Commands

- `pnpm dev` runs the docs on http://localhost:4777 against package source, so edits reload live.
- `pnpm check` and `pnpm fix` run ultracite (oxlint type-aware and oxfmt).
- `pnpm type` type-checks every workspace.
- `pnpm test` runs unit tests in node and browser tests in chromium, firefox and webkit.
- `pnpm build:packages`, `pnpm lint:package` (publint and attw), `pnpm size` (size-limit).
- `pnpm sim` opens the docs in a booted iOS simulator. Boot one with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl boot <device>`.

All of check, type, test, lint:package and size must pass before a commit.

## Toolchain notes

- The packages use TypeScript 7 with `isolatedDeclarations`, so every export needs an explicit type.
- The docs app stays on TypeScript 5.9, because fumadocs-typescript needs the compiler API, which TypeScript 7 lacks until 7.1.
- The packages build with tsdown in unbundle mode, ESM only, per-file output, so `"use client"` stays on each file. tsdown warns that the directive "may not be preserved". It is preserved; check `dist` if in doubt.
- pnpm refuses releases younger than one day (`minimumReleaseAge`). Pin the previous version instead of turning it off.
- Test files: `*.test.ts` run in node, `*.browser.test.tsx` run in the three browsers. Property tests for maths use fast-check.

## Rules

- Zero runtime dependencies. `@zriz/core` depends on nothing, `@zriz/react` only on `@zriz/core` with `react` 19+ as a peer. Write it ourselves; a new runtime dependency needs the owner's approval. Dev dependencies are fine.
- No code comments, TSDoc included. The one exception: a single short line on public props of React parts, because the docs generate API tables from it. Never restate what the code or the name already says.
- Never add AI attribution to commits, PRs or docs.
- Local git only. Push, open PRs or publish to npm only when the owner says so.
- Prose runs through the unslop skill: no em dashes, no arrows, no "·" separators.
- Icons are custom SVG, never Lucide.
- Check motion by recording it at real frame rate and comparing with iOS. A still screenshot does not test motion.
- Per-frame values never go through React state. Use refs, CSS variables and subscriptions.
- Close every browser tab and simulator you open for testing.
