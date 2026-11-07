import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useCoverScale } from "../src";

const IMAGE = { height: 900, width: 1200 };

describe(useCoverScale, () => {
  it("is 1 for a matching crop and zooms in once the photo is straightened", async () => {
    const { rerender, result } = await renderHook(
      (rotation?: number) =>
        useCoverScale({ crop: IMAGE, image: IMAGE, rotation }),
      { initialProps: 0 }
    );

    expect(result.current).toBe(1);
    await rerender(7);
    expect(result.current).toBeGreaterThan(1);
  });
});
