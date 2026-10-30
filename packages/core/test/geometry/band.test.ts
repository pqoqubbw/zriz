import { assert, double, pre, property } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  inverseRubberBand,
  inverseRubberBandRange,
  rubberBand,
  rubberBandRange,
} from "../../src/geometry";

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

  it("is continuous at the limits and round-trips", () => {
    assert(
      property(
        num(-1000, 1000),
        num(-100, 0),
        num(0, 100),
        num(1, 500),
        (v, min, max, d) => {
          const shown = rubberBandRange(v, min, max, d);
          expect(
            Math.abs(inverseRubberBandRange(shown, min, max, d) - v)
          ).toBeLessThan(1e-6 * Math.max(1, Math.abs(v)));
        }
      )
    );
    expect(rubberBandRange(100 + 1e-9, 0, 100, 50)).toBeCloseTo(100, 8);
  });
});
