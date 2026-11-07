import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import {
  choose,
  drag,
  forcedColors,
  gc,
  hold,
  pinch,
  release,
  touch,
} from "./test/commands.ts";

const react18 = fileURLToPath(
  new URL("test/react18/node_modules/", import.meta.url)
);

const warn = {
  find: "@zriz/react/warn",
  replacement: fileURLToPath(
    new URL("packages/react/src/warn.ts", import.meta.url)
  ),
};

const alias = [
  warn,
  { find: /^react(?<path>\/.*)?$/u, replacement: `${react18}react$<path>` },
  {
    find: /^react-dom(?<path>\/.*)?$/u,
    replacement: `${react18}react-dom$<path>`,
  },
];

const unit = {
  environment: "node" as const,
  exclude: ["**/*.browser.test.*", "**/node_modules/**"],
  setupFiles: ["packages/core/test/setup.ts"],
  testTimeout: 120_000,
};

const ENGINES = {
  chromium: { browser: "chromium" as const, maxWorkers: 1 },
  firefox: {
    browser: "firefox" as const,
    maxWorkers: 1,
    provider: playwright({
      launchOptions: {
        firefoxUserPrefs: { "gfx.color_management.mode": 2 },
      },
    }),
  },
  webkit: { browser: "webkit" as const, maxWorkers: 1 },
};

const browser = (engines: (keyof typeof ENGINES)[]) => ({
  commands: {
    choose,
    drag,
    forcedColors,
    gc,
    hold,
    pinch,
    release,
    touch,
  },
  enabled: true,
  headless: true,
  instances: engines.map((engine) => ({ ...ENGINES[engine] })),
  provider: playwright(),
});

const ENGINE_TESTS = [
  "packages/core/test/dom/dial.browser.test.ts",
  "packages/core/test/dom/export-csp.browser.test.ts",
  "packages/core/test/dom/image.browser.test.ts",
  "packages/core/test/dom/load-csp.browser.test.ts",
  "packages/core/test/dom/photo.browser.test.ts",
  "packages/core/test/dom/stage.browser.test.ts",
  "packages/react/test/cursor.browser.test.tsx",
  "packages/react/test/flows.browser.test.tsx",
  "packages/react/test/style-csp.browser.test.tsx",
  "packages/react/test/styles.browser.test.tsx",
];

const optimizeDeps = { include: ["react-dom/client", "react-dom/server"] };

const docsDeps = {
  entries: [
    "apps/docs/components/**/*.tsx",
    "apps/docs/demos/**/*.tsx",
    "apps/docs/test/**/*.browser.test.tsx",
  ],
  include: [...optimizeDeps.include, "axe-core", "vitest-browser-react"],
};

const docs = fileURLToPath(new URL("apps/docs/", import.meta.url));

const coreFile = (file: string): string =>
  fileURLToPath(new URL(`packages/core/dist/${file}`, import.meta.url));

const core = [
  { find: /^@zriz\/core$/u, replacement: coreFile("index.js") },
  { find: /^@zriz\/core\/dom$/u, replacement: coreFile("dom/index.js") },
  {
    find: /^@zriz\/core\/styles\.css$/u,
    replacement: coreFile("styles.css"),
  },
];

export default defineConfig({
  test: {
    maxWorkers: 2,
    projects: [
      {
        resolve: { alias: [{ find: /^@\//u, replacement: docs }, ...core] },
        test: {
          environment: "node",
          include: ["apps/docs/test/**/*.test.ts"],
          name: "docs",
          setupFiles: ["apps/docs/test/setup.ts"],
          testTimeout: 60_000,
        },
      },
      {
        resolve: { alias: [warn] },
        test: {
          ...unit,
          include: ["packages/*/test/**/*.test.ts"],
          name: "unit",
        },
      },
      {
        cacheDir: "node_modules/.vitest-cache/vite",
        css: { postcss: docs },
        optimizeDeps: docsDeps,
        plugins: [react()],
        resolve: {
          alias: [{ find: /^@\//u, replacement: docs }, warn, ...core],
        },
        test: {
          browser: browser(["chromium", "firefox", "webkit"]),
          include: ENGINE_TESTS,
          name: "browser",
        },
      },
      {
        cacheDir: "node_modules/.vitest-cache/vite",
        css: { postcss: docs },
        optimizeDeps: docsDeps,
        plugins: [react()],
        resolve: {
          alias: [{ find: /^@\//u, replacement: docs }, warn, ...core],
        },
        test: {
          browser: browser(["chromium"]),
          exclude: [...ENGINE_TESTS, "**/node_modules/**"],
          include: ["packages/*/test/**/*.browser.test.{ts,tsx}"],
          name: "browser-dom",
        },
      },
      {
        cacheDir: "node_modules/.vitest-cache/vite",
        css: { postcss: docs },
        optimizeDeps: docsDeps,
        plugins: [react()],
        resolve: {
          alias: [{ find: /^@\//u, replacement: docs }, warn, ...core],
        },
        test: {
          browser: browser(["chromium"]),
          include: ["apps/docs/test/**/*.browser.test.tsx"],
          name: "browser-docs",
        },
      },
      {
        resolve: { alias },
        test: {
          ...unit,
          include: [
            "packages/react/test/ssr.test.ts",
            "packages/react/test/errors.test.ts",
          ],
          name: "unit-react18",
        },
      },
      {
        optimizeDeps,
        plugins: [react()],
        resolve: { alias },
        test: {
          browser: browser(["chromium"]),
          include: [
            "packages/react/test/children.browser.test.tsx",
            "packages/react/test/lifetimes.browser.test.tsx",
            "packages/react/test/refs.browser.test.tsx",
          ],
          name: "browser-react18",
        },
      },
    ],
  },
});
