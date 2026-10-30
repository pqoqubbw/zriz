import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  env: core.env ?? {},
  extends: [core, react, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "notes/**",
    "apps/docs/public/sketch/**",
  ],
  options: { typeAware: true },
  overrides: [
    {
      files: ["apps/docs/**"],
      plugins: next.plugins ?? [],
      rules: { ...next.rules, "nextjs/no-html-link-for-pages": "off" },
    },
    {
      files: ["apps/docs/next.config.ts"],
      rules: { "eslint/require-await": "off" },
    },
    {
      files: [
        "**/*.browser.test.ts",
        "**/*.browser.test.tsx",
        "test/commands.ts",
        "packages/core/test/fixtures/make.ts",
      ],
      rules: { "eslint/no-await-in-loop": "off", "promise/avoid-new": "off" },
    },
    {
      files: [
        "packages/core/src/dom/image.ts",
        "packages/core/src/dom/worker.ts",
      ],
      rules: { "promise/avoid-new": "off" },
    },
    {
      files: ["packages/core/src/dom/kernel.ts"],
      rules: {
        "eslint/no-await-in-loop": "off",
        "promise/avoid-new": "off",
        "unicorn/consistent-function-scoping": "off",
      },
    },
    {
      files: ["packages/react/src/**"],
      rules: {
        "react/hook-use-state": "off",
      },
    },
    {
      files: ["apps/docs/demos/**"],
      plugins: next.plugins ?? [],
      rules: { ...next.rules, "nextjs/no-img-element": "off" },
    },
    {
      files: ["apps/docs/components/demo.tsx"],
      rules: { "react/no-danger": "off" },
    },
  ],
});
