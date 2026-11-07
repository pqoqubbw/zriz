import { assert, double, nat, property } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  cropCorners,
  linearTransform,
  mirrorX,
  mirrorY,
  multiplyMatrix2,
  rotateLeft,
  rotateRight,
  setAngle,
  sinCosDegrees,
  sourceToWorking,
  workingToSource,
} from "../../src/geometry";
import type { CropState, Matrix2, Point } from "../../src/geometry";
import { stateArb } from "./arbitraries";

const unitInterval = double({ max: 1, min: 0, noNaN: true });

const expectClose = (a: number, b: number, tolerance: number): void => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
};

const expectSameRegion = (
  a: readonly Point[],
  b: readonly Point[],
  tolerance: number
): void => {
  for (const p of a) {
    expect(
      b.some(
        (q) =>
          Math.abs(p.x - q.x) <= tolerance && Math.abs(p.y - q.y) <= tolerance
      )
    ).toBeTruthy();
  }
};

describe("state", () => {
  it("round-trips source to working to source, exactly with no straighten", () => {
    assert(
      property(stateArb, unitInterval, unitInterval, (s, u, v) => {
        const p = { x: u * s.image.width, y: v * s.image.height };
        const back = workingToSource(s, sourceToWorking(s, p));
        const tol = 4e-16 * 8 * Math.max(s.image.width, s.image.height);

        expectClose(back.x, p.x, tol);
        expectClose(back.y, p.y, tol);
      })
    );

    assert(
      property(stateArb, nat(), nat(), (s0, i, j) => {
        const s = { ...s0, angle: 0 };
        const p = { x: i % (s.image.width + 1), y: j % (s.image.height + 1) };

        expect(workingToSource(s, sourceToWorking(s, p))).toStrictEqual(p);
      })
    );
  });

  it("gives exact and symmetric degree trig at multiples of 45", () => {
    for (let k = -16; k <= 16; k += 1) {
      const { sin, cos } = sinCosDegrees(k * 45);
      const quarter = k % 2 === 0;
      const sine = quarter ? ((k / 2) % 2) ** 2 : Math.SQRT1_2;

      expect(Math.abs(sin)).toBe(sine);
      expect(Math.abs(cos)).toBe(quarter ? 1 - sine : Math.SQRT1_2);
    }

    expect(sinCosDegrees(90).sin).toBe(1);
    expect(sinCosDegrees(180).cos).toBe(-1);

    assert(
      property(double({ max: 45, min: -45, noNaN: true }), (a) => {
        expect(sinCosDegrees(-a).sin + 0).toBe(-sinCosDegrees(a).sin + 0);
        expect(sinCosDegrees(-a).cos).toBe(sinCosDegrees(a).cos);
      })
    );
  });

  it("keeps the same source pixels under view actions, composed as view matrices, with turns and mirrors that undo exactly", () => {
    const actions: readonly (readonly [
      (s: CropState) => CropState,
      Matrix2,
    ])[] = [
      [rotateRight, [0, -1, 1, 0]],
      [rotateLeft, [0, 1, -1, 0]],
      [mirrorX, [-1, 0, 0, 1]],
      [mirrorY, [1, 0, 0, -1]],
    ];

    assert(
      property(stateArb, (s) => {
        const tol = 1e-9 * Math.max(s.image.width, s.image.height);
        const source = cropCorners(s.crop).map((q) => workingToSource(s, q));

        for (const [action, g] of actions) {
          const t = action(s);

          expectSameRegion(
            source,
            cropCorners(t.crop).map((q) => workingToSource(t, q)),
            tol
          );

          const want = multiplyMatrix2(g, linearTransform(s));

          for (const [i, value] of linearTransform(t).entries()) {
            expectClose(value, want[i] ?? Number.NaN, 1e-15);
          }
        }

        const turned = rotateRight(rotateRight(rotateRight(rotateRight(s))));

        expect({ ...turned, aspect: s.aspect }).toStrictEqual(s);
        expect(turned.aspect ?? 0).toBeCloseTo(s.aspect ?? 0, 9);
        expect(mirrorX(mirrorX(s))).toStrictEqual(s);
        expect(mirrorY(mirrorY(s))).toStrictEqual(s);
      })
    );
  });

  it("pivots about the crop centre when the angle changes", () => {
    assert(
      property(stateArb, double({ max: 45, min: -45, noNaN: true }), (s, a) => {
        const before = workingToSource(s, { x: s.crop.x, y: s.crop.y });
        const t = setAngle(s, a);
        const after = workingToSource(t, { x: t.crop.x, y: t.crop.y });
        const tol = 1e-9 * Math.max(s.image.width, s.image.height);

        expectClose(after.x, before.x, tol);
        expectClose(after.y, before.y, tol);
      })
    );
  });
});
