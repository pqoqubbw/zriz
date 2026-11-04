import { setTimeout as wait } from "node:timers/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { afterPaint } from "../../src/dom/later";

describe("loading after paint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads on a timer where there are no animation frames, and swallows a failed load", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    let loads = 0;

    afterPaint(async () => {
      loads += 1;
      await Promise.resolve();
      throw new Error("offline");
    });

    expect(loads).toBe(0);

    await vi.waitFor(() => {
      expect(loads).toBe(1);
    });

    await wait(0);
  });
});
