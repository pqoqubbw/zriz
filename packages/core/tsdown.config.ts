import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: [
    "src/index.ts",
    "src/geometry/index.ts",
    "src/dom/index.ts",
    "src/dom/render.ts",
    "src/dom/svg.ts",
    "src/dom/source.ts",
    "src/dom/sharpen.ts",
  ],
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  unbundle: true,
});
