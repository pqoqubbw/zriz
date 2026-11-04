import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

import { transform } from "lightningcss";

const BUDGET = 978;
const version = (major: number): number => major * 65_536;

const root = path.resolve(import.meta.dirname, "..");
const { code } = transform({
  code: readFileSync(path.resolve(root, "packages/core/src/styles.css")),
  filename: "styles.css",
  minify: true,
  targets: { chrome: version(139), firefox: version(142), safari: version(18) },
});
const gzip = gzipSync(code, { level: 9 }).length;
if (gzip > BUDGET) {
  throw new Error(`styles.css is ${gzip} B gzip, over the ${BUDGET} B budget`);
}
for (const out of process.argv.slice(2)) {
  const file = path.resolve(process.cwd(), out);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, code);
  writeFileSync(file.replace(/\.css$/u, ".d.css.ts"), "export {};\n");
}
