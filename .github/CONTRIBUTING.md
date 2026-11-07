# Contributing

Thanks for wanting to help. zriz has one maintainer, and the most useful thing you can send is an issue.

## Issues, not pull requests

Please don't open pull requests, fixes included. Open an [issue](https://github.com/pqoqubbw/zriz/issues/new/choose) instead.

Most fixes today come out of a coding agent. To review one, I would read code your agent wrote and then ask mine to check it. Running my own agent on a clear issue gets the same fix faster, and the code stays in one style. So I put my time into issues and close pull requests with a link to this page.

A good issue has:

- a reproduction link (StackBlitz, CodeSandbox or a public repo) with the smallest code that shows the problem;
- the steps, what you expected and what happened;
- the zriz version from your lockfile, the browser and the input (mouse, trackpad, touch, keyboard or screen reader).

For a feature, start with the problem you are solving, not the API. zriz keeps a small API and no runtime dependencies, so good ideas sometimes still get a no.

Security problems go to [SECURITY.md](SECURITY.md), never a public issue.

## Add a prompt for the fix

If you already found the cause, I'd really appreciate a prompt I can hand to a coding agent. Paste it into the issue's "Fix prompt" field. It helps most when it names:

- the files and lines to change, and what the change is;
- the test that proves it, and which browsers it runs in;
- what must not change, such as a prop, a default or the size budget.

For example:

> In `packages/core/src/styles.css`, the `::after` frame on `[data-zriz-item="area"][data-visible]` catches presses meant for the handles. Add `pointer-events: none` to it. Add a browser test in `packages/react/test/styles.browser.test.tsx` that samples every point of each handle's box with `document.elementFromPoint` and expects the handle. Run it in Chromium, Firefox and WebKit. The stylesheet must stay under the gzip budget in `scripts/css.ts`.

Write the prompt against the rules below and [AGENTS.md](../AGENTS.md), so the agent follows them too.

## Run it locally

You need this to check a reproduction or a prompt before you post it.

- Node: the version in `.nvmrc`. `nvm use` and `fnm use` read it. pnpm stops with an error on a Node outside `engines.node` in `package.json`.
- pnpm: any pnpm 10 or newer. It switches itself to the exact version in `packageManager`. npm stops with an error in this repo.

From the repo root:

```sh
pnpm install
pnpm exec playwright install --only-shell chromium firefox webkit
pnpm build:packages
pnpm type
pnpm check
pnpm test
```

On Linux, add `--with-deps` to the Playwright command. Run `pnpm build:packages` again after you change `packages/core` or `packages/react`, because checks and tests read the packages from `dist`.

`pnpm dev` serves the docs on http://localhost:4777 and reloads as you edit the packages. If the port is taken, run `pnpm dev -p 4800`.

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

## Code rules

- No new runtime dependencies. `@zriz/core` depends on nothing. `@zriz/react` has `@zriz/core` and `react` as peers.
- No code comments, TSDoc included. The one exception is a single short line on public props of React parts. API tables are hand-written in `apps/docs/content/<slug>.ts`, so a change to the API changes them too.
- Every export in `packages/` needs an explicit type (`isolatedDeclarations`).
- Files in `packages/react` that use hooks or browser APIs start with `"use client"`. Nothing in `packages/core` does.
- Values that change every frame never go through React state. Use refs, CSS variables and subscriptions.
- A fix comes with a test. `*.test.ts` runs in node, `*.browser.test.ts` and `*.browser.test.tsx` run in the three browsers. In `apps/docs`, only `.browser.test.tsx` reaches the browsers.
