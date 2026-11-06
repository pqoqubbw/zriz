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

const browser = () => ({
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
  instances: [
    { browser: "chromium" as const, maxWorkers: 1 },
    {
      browser: "firefox" as const,
      maxWorkers: 1,
      provider: playwright({
        launchOptions: {
          firefoxUserPrefs: { "gfx.color_management.mode": 2 },
        },
      }),
    },
    { browser: "webkit" as const, maxWorkers: 1 },
  ],
  provider: playwright(),
});

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
          browser: browser(),
          include: [
            "apps/docs/test/**/*.browser.test.tsx",
            "packages/*/test/**/*.browser.test.{ts,tsx}",
          ],
          name: "browser",
        },
      },
      {
        resolve: { alias },
        test: {
          ...unit,
          include: ["packages/react/test/**/*.test.ts"],
          name: "unit-react18",
        },
      },
      {
        optimizeDeps,
        plugins: [react()],
        resolve: { alias },
        test: {
          browser: browser(),
          include: ["packages/react/test/**/*.browser.test.{ts,tsx}"],
          name: "browser-react18",
        },
      },
    ],
  },
});
