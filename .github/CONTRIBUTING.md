# Contributing

zriz has one maintainer, so small pull requests that do one thing get merged fastest.

## Before you write code

- Bug: open an issue with a reproduction first, unless the fix is a few lines.
- Feature or API change: open an issue and wait for a yes. zriz keeps a small API and no runtime dependencies, so good ideas sometimes still get a no.
- Security problem: follow [SECURITY.md](SECURITY.md). Never a public issue.

## Setup

- Node: the version in `.nvmrc`. `nvm use` and `fnm use` read it. With mise, run `mise settings add idiomatic_version_file_enable_tools node` once. pnpm stops with an error on a Node outside `engines.node` in `package.json`.
- pnpm: any pnpm 10 or newer. It downloads and runs the exact version in `packageManager` by itself, so you don't need Corepack. npm stops with an error in this repo.

Then, from the repo root:

```sh
pnpm install
pnpm exec playwright install --only-shell chromium firefox webkit
pnpm build:packages
pnpm type
pnpm check
pnpm test
```

On Linux, add `--with-deps` to the Playwright command so it also installs the system libraries the browsers need. The three browsers take about 800 MB and only need installing again when Playwright updates.

`pnpm check`, `pnpm type` and `pnpm test` read the packages from `dist`. Run `pnpm build:packages` again after you change `packages/core`.

`pnpm dev` serves the docs on http://localhost:4777 and reloads as you edit the packages. If the port is taken, run `pnpm dev -p 4800`.

### Editor

The repo ships settings for VS Code, Cursor and Zed, and an `.editorconfig` for the rest.

- VS Code and Cursor: install the recommended extensions when asked. Oxc lints with oxlint and formats with oxfmt on save, using the repo's `oxlint.config.ts` and `oxfmt.config.ts`. Tailwind CSS IntelliSense completes classes inside `cn()` and `cva()`. When the editor asks whether to use the workspace TypeScript, say yes. That copy is TypeScript 5.9 from `apps/docs`, which runs the Next.js plugin. `pnpm type` checks the packages with TypeScript 7.
- Zed: install the Oxc extension. `.zed/settings.json` does the rest.
- WebStorm and other JetBrains IDEs: install the Oxc plugin and turn on fix and format on save in its settings.
- Any other editor: run `pnpm fix` before you commit.

### Coding agents

`AGENTS.md` holds the commands and rules for Claude Code, Codex, Cursor, Copilot and other agents. `CLAUDE.md` only imports it. Agents never push, open pull requests or comment unless you ask for that step.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm check` | Lint and format check |
| `pnpm fix` | Fix what `check` can fix |
| `pnpm type` | Type-check every workspace |
| `pnpm test` | Unit tests in node, browser tests in Chromium, Firefox and WebKit |
| `pnpm test:unit` | Node tests only |
| `pnpm test:browser` | Browser tests only |
| `pnpm build:packages` | Build `@zriz/core` and `@zriz/react` |
| `pnpm lint:package` | publint and are-the-types-wrong on the built packages |
| `pnpm size` | Bundle size limits |

## What CI runs

Every pull request and every push to `main` runs lint, format, types, the package checks, node tests on Node 22, 24 and 26, browser tests in Chromium on Linux and in Firefox and WebKit on macOS, the bundle size limits and the docs build. The size job writes a table of every entry against `main` into the run summary. A pull request can merge only when all of it passes.

CI on a pull request from a fork waits until I approve the run, and again after each new push. That can take a day.

## Releases

You don't need a changelog entry or a version bump. If a user could notice your change, say what they would notice in the pull request. The maintainer writes the changelog when cutting a release, and both packages always release together.

## Code rules

- No new runtime dependencies. `@zriz/core` depends on nothing, `@zriz/react` only on `@zriz/core`.
- Don't add, remove or upgrade dependencies in a pull request that is about something else.
- No code comments, TSDoc included. The one exception is a single short line on public props of React parts, because the docs build their API tables from it.
- Every export in `packages/` needs an explicit type (`isolatedDeclarations`).
- Files in `packages/react` that use hooks or browser APIs start with `"use client"`. Nothing in `packages/core` does.
- Values that change every frame never go through React state. Use refs, CSS variables and subscriptions.
- A fix comes with a test. `*.test.ts` runs in node, `*.browser.test.tsx` runs in the three browsers.

## Pull requests

- One change per pull request.
- The title becomes the commit message, because pull requests are squash merged.
- If an AI tool wrote part of the code, you are still the author. Read and understand every line before you open the pull request.
