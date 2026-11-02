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
    "apps/docs/snippets/**",
  ],
  options: { typeAware: true },
  overrides: [
    {
      files: ["apps/docs/**"],
      plugins: next.plugins ?? [],
      rules: { ...next.rules, "nextjs/no-html-link-for-pages": "off" },
    },
    {
      files: ["apps/docs/components/doc/code-block.tsx"],
      rules: {
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "react/no-danger": "off",
      },
    },
    {
      files: ["apps/docs/components/doc/controls.tsx"],
      rules: { "jsx-a11y/role-has-required-aria-props": "off" },
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
      files: [
        "packages/core/src/dom/kernel.ts",
        "packages/core/src/dom/render-kernel.ts",
      ],
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
      files: [
        "packages/react/src/parts/**",
        "packages/react/test/**",
        "test/react18/**",
      ],
      rules: { "eslint/prefer-arrow-callback": "off" },
    },
  ],
});
