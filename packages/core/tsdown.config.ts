import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts", "src/geometry/index.ts"],
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  unbundle: true,
});
