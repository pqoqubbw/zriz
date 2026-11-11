import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import CHECKS from "../../../packages/react/.size-limit.ts";
import { LIMITS, measure } from "../../../scripts/lazy-chunks.ts";
import { AVATAR_TOTAL, LAZY_CHUNKS } from "../content/bundle-size-chunks.ts";

describe("lazy chunks of the avatar set", () => {
  it("match the bundle size page, which node scripts/lazy-chunks.ts writes", async () => {
    const measured = await measure();

    expect(measured).toStrictEqual({
      chunks: LAZY_CHUNKS,
      total: AVATAR_TOTAL,
    });

    expect(Object.keys(measured.chunks)).toStrictEqual(Object.keys(LIMITS));

    for (const [name, size] of Object.entries(measured.chunks)) {
      expect(size).toBeLessThanOrEqual(LIMITS[name] ?? 0);
    }
  });

  it("measures the editor set with every part the cropper entry exports", () => {
    const source = readFileSync(
      new URL("../../../packages/react/src/cropper.ts", import.meta.url),
      "utf-8"
    );
    const parts = [...source.matchAll(/export \{ (?<name>\w+) \}/gu)].map(
      (match) => match.groups?.name
    );
    const editor = CHECKS.find((check) => check.name === "editor (every part)");

    expect(editor?.import).toBe(`{ ${parts.join(", ")} }`);
  });
});
