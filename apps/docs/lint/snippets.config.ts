import { defineConfig } from "oxlint";

import { PADDING } from "./padding.mjs";

const config = defineConfig({
  categories: { correctness: "off" },
  jsPlugins: ["@stylistic/eslint-plugin"],
  rules: {
    "@stylistic/padding-line-between-statements": PADDING,
    "typescript/consistent-type-definitions": ["error", "type"],
  },
});

export default config;
