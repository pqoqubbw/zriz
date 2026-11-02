import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "notes/**",
    "BRIEF.md",
    "apps/docs/snippets/**/*.html",
  ],
  overrides: [
    {
      files: ["apps/docs/snippets/**"],
      options: { printWidth: 64, sortImports: false },
    },
    {
      files: ["apps/docs/snippets/**/*.jsx.tsx"],
      options: { printWidth: 66, sortImports: false },
    },
  ],
});
