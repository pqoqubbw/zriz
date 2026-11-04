import { assert, double, nat, property } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyMatrix2,
  cropCorners,
  deserialiseState,
  exifOrientations,
  linearTransform,
  mirrorX,
  mirrorY,
  multiplyMatrix2,
  orientationMatrix,
  quarterTurnMatrix,
  rotateLeft,
  rotateRight,
  rotationMatrix,
  serialiseState,
  setAngle,
  sinCosDegrees,
  sourceToWorking,
  splitAngle,
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
  it("round-trips source to working to source", () => {
    assert(
      property(stateArb, unitInterval, unitInterval, (s, u, v) => {
        const p = { x: u * s.image.width, y: v * s.image.height };
        const back = workingToSource(s, sourceToWorking(s, p));
        const tol = 4e-16 * 8 * Math.max(s.image.width, s.image.height);
        expectClose(back.x, p.x, tol);
        expectClose(back.y, p.y, tol);
      })
    );
  });

  it("round-trips pixel corners exactly with no straighten", () => {
    assert(
      property(stateArb, nat(), nat(), (s0, i, j) => {
        const s = { ...s0, angle: 0 };
        const p = { x: i % (s.image.width + 1), y: j % (s.image.height + 1) };
        expect(workingToSource(s, sourceToWorking(s, p))).toStrictEqual(p);
      })
    );
  });

  it("round-trips through JSON bit exact", () => {
    assert(
      property(stateArb, (s) => {
        expect(deserialiseState(serialiseState(s))).toStrictEqual(
          structuredClone(s)
        );
      })
    );
  });

  it("gives exact values on every quarter turn and diagonal", () => {
    for (let k = -16; k <= 16; k += 1) {
      const { sin, cos } = sinCosDegrees(k * 45);
      const quarter = k % 2 === 0;
      const sine = quarter ? ((k / 2) % 2) ** 2 : Math.SQRT1_2;
      expect(Math.abs(sin)).toBe(sine);
      expect(Math.abs(cos)).toBe(quarter ? 1 - sine : Math.SQRT1_2);
    }
  });

  it("gives exact and symmetric degree trig at multiples of 45", () => {
    const exact = [
      sinCosDegrees(45).sin - sinCosDegrees(45).cos,
      sinCosDegrees(90).sin,
      sinCosDegrees(90).cos,
      sinCosDegrees(180).sin,
      sinCosDegrees(180).cos,
    ].map((value) => value + 0);
    expect(exact).toStrictEqual([0, 1, 0, 0, -1]);
    assert(
      property(double({ max: 45, min: -45, noNaN: true }), (a) => {
        expect(sinCosDegrees(-a).sin + 0).toBe(-sinCosDegrees(a).sin + 0);
        expect(sinCosDegrees(-a).cos).toBe(sinCosDegrees(a).cos);
      })
    );
  });

  it("splits any angle into quarter turns plus a straighten within 45", () => {
    assert(
      property(double({ max: 1000, min: -1000, noNaN: true }), (d) => {
        const { turns, angle } = splitAngle(d);
        expect(Math.abs(angle)).toBeLessThanOrEqual(45);
        const a = multiplyMatrix2(
          rotationMatrix(angle),
          quarterTurnMatrix(turns)
        );
        const b = rotationMatrix(d);
        for (const [i, value] of a.entries()) {
          expectClose(value, b[i] ?? Number.NaN, 1e-12);
        }
      })
    );
  });

  it("keeps the same source pixels under view actions, composed as view matrices", () => {
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
      })
    );
  });

  it("makes four right turns and two mirrors exact identities", () => {
    assert(
      property(stateArb, (s) => {
        const turned = rotateRight(rotateRight(rotateRight(rotateRight(s))));
        expect({ ...turned, aspect: s.aspect }).toStrictEqual(s);
        expect(turned.aspect ?? 0).toBeCloseTo(s.aspect ?? 0, 9);
        expect(mirrorX(mirrorX(s))).toStrictEqual(s);
        expect(mirrorY(mirrorY(s))).toStrictEqual(s);
      })
    );
  });

  it("makes flipY equal flipX plus a half turn", () => {
    const m = orientationMatrix(2, true);
    expect([m[0], m[1] === 0, m[2] === 0, m[3]]).toStrictEqual([
      1,
      true,
      true,
      -1,
    ]);
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

  it("maps the eight EXIF orientations to the eight distinct elements of D4", () => {
    const matrices = Object.values(exifOrientations).map((o) =>
      orientationMatrix(o.turns, o.flip)
        .map((v) => v + 0)
        .join(",")
    );
    expect(new Set(matrices).size).toBe(8);
    expect(
      orientationMatrix(
        exifOrientations[5].turns,
        exifOrientations[5].flip
      ).map((v) => v + 0)
    ).toStrictEqual([0, 1, 1, 0]);
    expect(
      orientationMatrix(
        exifOrientations[7].turns,
        exifOrientations[7].flip
      ).map((v) => v + 0)
    ).toStrictEqual([0, -1, -1, 0]);
    expect(
      applyMatrix2(
        orientationMatrix(exifOrientations[6].turns, exifOrientations[6].flip),
        { x: 1, y: 0 }
      )
    ).toStrictEqual({ x: 0, y: 1 });
  });
});
