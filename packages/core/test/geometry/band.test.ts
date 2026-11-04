import { assert, double, pre, property } from "fast-check";
import { describe, expect, it } from "vitest";

import { inverseRubberBand, rubberBand } from "../../src/geometry";

const num = (min: number, max: number) => double({ max, min, noNaN: true });

describe("rubber band", () => {
  it("is zero at zero, slope c, bounded by d, monotone and invertible", () => {
    assert(
      property(num(0, 1e6), num(1, 5000), num(0.1, 1), (x, d, c) => {
        const y = rubberBand(x, d, c);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(d);
        expect(y).toBeLessThanOrEqual(c * x + 1e-9);
        expect(rubberBand(x * 1.01 + 1e-6, d, c)).toBeGreaterThanOrEqual(y);
        pre(y < d * 0.999);
        expect(Math.abs(inverseRubberBand(y, d, c) - x)).toBeLessThan(
          1e-6 * Math.max(1, x)
        );
      })
    );
    expect(rubberBand(1e-6, 100) / 1e-6).toBeCloseTo(0.55, 5);
  });

  it("has no inverse at or past the distance", () => {
    expect(inverseRubberBand(10, 10)).toBe(Number.POSITIVE_INFINITY);
    expect(inverseRubberBand(12, 10)).toBe(Number.POSITIVE_INFINITY);
  });
});
