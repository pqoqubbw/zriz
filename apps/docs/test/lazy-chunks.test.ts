import { describe, expect, it } from "vitest";

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
});
