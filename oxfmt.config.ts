import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

const { sortTailwindcss } = ultracite;

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
  sortTailwindcss: {
    ...(typeof sortTailwindcss === "object" ? sortTailwindcss : {}),
    stylesheet: "./apps/docs/app/globals.css",
  },
});
