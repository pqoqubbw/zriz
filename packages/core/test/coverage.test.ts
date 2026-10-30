import { assert, double, property, record } from "fast-check";
import { describe, expect, it } from "vitest";

import { coverScale, covers } from "../src";

const size = record({
  height: double({ max: 8000, min: 1, noNaN: true }),
  width: double({ max: 8000, min: 1, noNaN: true }),
});
const angle = double({ max: Math.PI / 4, min: -Math.PI / 4, noNaN: true });

describe(coverScale, () => {
  it("leaves no empty corners", () => {
    assert(
      property(size, size, angle, (image, crop, a) => {
        const scale = coverScale(image, crop, a);
        const epsilon = 1e-6 * scale * Math.max(image.width, image.height);
        expect(covers(image, crop, a, scale, epsilon)).toBeTruthy();
      })
    );
  });

  it("is the smallest scale that covers", () => {
    assert(
      property(size, size, angle, (image, crop, a) => {
        expect(
          covers(image, crop, a, coverScale(image, crop, a) * 0.999, 0)
        ).toBeFalsy();
      })
    );
  });

  it("is symmetric in the angle", () => {
    assert(
      property(size, size, angle, (image, crop, a) => {
        expect(coverScale(image, crop, -a)).toBeCloseTo(
          coverScale(image, crop, a),
          9
        );
      })
    );
  });

  it("swaps width and height on a quarter turn", () => {
    assert(
      property(size, size, (image, crop) => {
        const swapped = { height: image.width, width: image.height };
        expect(coverScale(image, crop, Math.PI / 2)).toBeCloseTo(
          coverScale(swapped, crop, 0),
          9
        );
      })
    );
  });
});
