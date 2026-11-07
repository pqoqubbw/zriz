import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

import { PADDING } from "./apps/docs/lint/padding.mjs";

export default defineConfig({
  env: core.env ?? {},
  extends: [core, react, vitest],
  ignorePatterns: [...(core.ignorePatterns ?? []), "apps/docs/snippets/**"],
  options: { typeAware: true },
  overrides: [
    {
      excludeFiles: ["apps/docs/snippets/**"],
      files: ["apps/docs/**", "packages/*/src/**", "packages/*/test/**"],
      jsPlugins: ["@stylistic/eslint-plugin", "./apps/docs/lint/style.mjs"],
      rules: {
        "@stylistic/padding-line-between-statements": PADDING,
        "docs/constant-case": "error",
        "docs/export-list": "error",
        "docs/no-class-variable": "error",
        "docs/props-type": "error",
        "import/exports-last": "error",
        "import/group-exports": "error",
        "typescript/consistent-type-definitions": ["error", "type"],
      },
    },
    {
      excludeFiles: ["apps/docs/snippets/**"],
      files: ["apps/docs/**"],
      plugins: next.plugins ?? [],
      rules: {
        ...next.rules,
        "nextjs/no-html-link-for-pages": "off",
      },
    },
    {
      files: [
        "packages/core/src/dom/controls.ts",
        "packages/core/src/dom/dial.ts",
        "packages/core/src/dom/parts.ts",
        "packages/core/src/dom/slider.ts",
        "packages/core/src/dom/view.ts",
        "packages/core/src/dom/viewport.ts",
        "packages/core/test/cropper.test.ts",
        "packages/core/test/review.test.ts",
        "packages/react/src/parts/root.tsx",
        "packages/react/src/use-cropper.ts",
      ],
      rules: { "typescript/no-unsafe-type-assertion": "off" },
    },
    {
      files: ["apps/docs/lint/**"],
      rules: {
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/strict-boolean-expressions": "off",
      },
    },
    {
      files: ["apps/docs/components/doc/code-figure.tsx"],
      rules: {
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "react/no-danger": "off",
      },
    },
    {
      files: ["apps/docs/components/doc/blocks.tsx"],
      rules: { "eslint/no-use-before-define": ["error", { variables: false }] },
    },
    {
      files: ["apps/docs/components/doc/controls.tsx"],
      rules: { "jsx-a11y/role-has-required-aria-props": "off" },
    },
    {
      files: ["apps/docs/app/**", "apps/docs/proxy.ts"],
      rules: { "import/group-exports": "off" },
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
        "packages/core/test/dom/deferred.ts",
        "packages/core/test/dom/image.test.ts",
        "packages/core/test/fixtures/make.ts",
      ],
      rules: { "eslint/no-await-in-loop": "off", "promise/avoid-new": "off" },
    },
    {
      files: [
        "packages/core/src/dom/image.ts",
        "packages/core/src/dom/source.ts",
        "packages/core/src/dom/svg.ts",
        "packages/core/src/dom/turn.ts",
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
