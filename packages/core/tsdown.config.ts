import { defineConfig } from "tsdown";

export default defineConfig({
  dts: { sourcemap: true },
  entry: ["src/index.ts", "src/dom/index.ts"],
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  unbundle: true,
});
