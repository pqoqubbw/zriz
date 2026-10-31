import { MagicString } from "magic-string";
import { defineConfig } from "tsdown";

const pure = {
  name: "zriz:pure",
  renderChunk: (code: string) => {
    const s = new MagicString(code);
    for (const match of code.matchAll(
      /^(?:export )?(?:const|let|var) [\w$]+ = (?=(?:createContext|forwardRef|memo)\()/gmu
    )) {
      s.appendLeft(match.index + match[0].length, "/* @__PURE__ */ ");
    }
    return s.hasChanged()
      ? { code: s.toString(), map: s.generateMap({ hires: true }) }
      : null;
  },
};

export default defineConfig({
  deps: { neverBundle: [/^@zriz\/react\//u] },
  dts: true,
  entry: ["src/index.ts", "src/cropper.ts", "src/warn.ts", "src/warn-off.ts"],
  format: "esm",
  platform: "neutral",
  plugins: [pure],
  sourcemap: true,
  unbundle: true,
});
