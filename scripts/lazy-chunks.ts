import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { brotliCompressSync, constants } from "node:zlib";

import CHECKS from "../packages/react/.size-limit.ts";
import PRESET from "../packages/react/node_modules/@size-limit/preset-small-lib/index.js";
import sizeLimit from "../packages/react/node_modules/size-limit/index.js";

interface Measured {
  chunks: Record<string, number>;
  total: number;
}

const CHECK_NAME = "avatar total (with lazy chunks)";
const EMPTY_PROJECT_IMPORT_BROTLI = 18;
const LIMITS: Record<string, number> = {
  render: 2950,
  sharpen: 556,
  source: 567,
  svg: 2140,
};

const root = path.resolve(import.meta.dirname, "..");
const react = path.join(root, "packages/react");
const data = path.join(root, "apps/docs/content/bundle-size-chunks.ts");

const brotli = (file: string): number =>
  brotliCompressSync(readFileSync(file), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;

const sizeOf = (result: unknown): number => {
  const first: unknown = Array.isArray(result) ? result.at(0) : undefined;

  if (
    typeof first !== "object" ||
    first === null ||
    !("size" in first) ||
    typeof first.size !== "number"
  ) {
    throw new TypeError("size-limit returned no size");
  }

  return first.size;
};

const measure = async (): Promise<Measured> => {
  const check = CHECKS.find((entry) => entry.name === CHECK_NAME);

  if (check === undefined) {
    throw new Error(
      `no "${CHECK_NAME}" check in packages/react/.size-limit.ts`
    );
  }

  const file = path.join(react, check.path);
  const dir = mkdtempSync(path.join(tmpdir(), "zriz-chunks-"));

  try {
    const total = sizeOf(
      await sizeLimit([PRESET], {
        checks: [{ ...check, files: [file], import: { [file]: check.import } }],
        cwd: react,
        saveBundle: dir,
      })
    );
    const files = readdirSync(dir).filter((name) => name.endsWith(".js"));
    const sum = files.reduce(
      (all, name) => all + brotli(path.join(dir, name)),
      0
    );

    if (sum - EMPTY_PROJECT_IMPORT_BROTLI !== total) {
      throw new Error(
        `the saved bundle is ${sum} B, size-limit measured ${total} B`
      );
    }

    const chunks = Object.fromEntries(
      Object.keys(LIMITS).map((name): [string, number] => {
        const found = files.filter((entry) => entry.startsWith(`${name}-`));

        if (found.length !== 1) {
          throw new Error(`expected one ${name} chunk, found ${found.length}`);
        }

        return [name, brotli(path.join(dir, String(found[0])))];
      })
    );

    return { chunks, total };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
};

const source = ({ chunks, total }: Measured): string =>
  [
    "const LAZY_CHUNKS = {",
    ...Object.entries(chunks).map(([name, size]) => `  ${name}: ${size},`),
    "};",
    `const AVATAR_TOTAL = ${total.toLocaleString("en-US").replaceAll(",", "_")};`,
    "",
    "export { AVATAR_TOTAL, LAZY_CHUNKS };",
    "",
  ].join("\n");

if (import.meta.main) {
  writeFileSync(data, source(await measure()));
  process.stdout.write(`wrote ${path.relative(root, data)}\n`);
}

export { LIMITS, measure, source };
