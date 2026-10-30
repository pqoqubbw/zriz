import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useCoverScale } from "../src";

const image = { height: 900, width: 1200 };

describe(useCoverScale, () => {
  it("is 1 when the crop matches the image and nothing is rotated", async () => {
    const { result } = await renderHook(() =>
      useCoverScale({ crop: image, image })
    );
    expect(result.current).toBe(1);
  });

  it("zooms in when the photo is straightened", async () => {
    const { result } = await renderHook(() =>
      useCoverScale({ crop: image, image, rotation: 7 })
    );
    expect(result.current).toBeGreaterThan(1.15);
    expect(result.current).toBeLessThan(1.16);
  });
});
