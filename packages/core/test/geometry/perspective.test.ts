import {
  array,
  assert,
  double,
  pre,
  property,
  record,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyHomography,
  imagePlanes,
  imageQuad,
  insidePlanes,
  largestFit,
  minScaleAt,
  perspectiveHomography,
  sourceToWorking,
  workingToSource,
} from "../../src/geometry";
import type { CropState, Point } from "../../src/geometry";
import { stateArb } from "./arbitraries";
import { isCropCovered, isPerspectiveValid } from "./oracles";

const num = (min: number, max: number) => double({ max, min, noNaN: true });
const perspectiveArb = record({
  f35: num(13, 120),
  horizontal: num(-30, 30),
  vertical: num(-30, 30),
});

const withPerspective = (
  s: CropState,
  p: { vertical: number; horizontal: number; f35: number }
): CropState => ({
  ...s,
  perspective: {
    focal: (p.f35 / 36) * Math.max(s.image.width, s.image.height),
    horizontal: p.horizontal,
    vertical: p.vertical,
  },
});

const spanOf = (quad: readonly Point[]): number =>
  Math.max(
    ...quad.map((q) => Math.abs(q.x)),
    ...quad.map((q) => Math.abs(q.y))
  );

describe("perspective", () => {
  it("fixes the centre with the homography", () => {
    assert(
      property(perspectiveArb, (p) => {
        const h = perspectiveHomography({ ...p, focal: 1000 });

        expect(applyHomography(h, { x: 0, y: 0 })).toStrictEqual({
          x: 0,
          y: 0,
        });
      })
    );
  });

  it("round-trips source to working with perspective", () => {
    assert(
      property(
        stateArb,
        perspectiveArb,
        num(0, 1),
        num(0, 1),
        (s0, p, u, v) => {
          const s = withPerspective(s0, p);

          pre(isPerspectiveValid(s.image, s.perspective));
          const q = { x: u * s.image.width, y: v * s.image.height };
          const back = workingToSource(s, sourceToWorking(s, q));
          const tol = 1e-9 * Math.max(s.image.width, s.image.height);

          expect(Math.abs(back.x - q.x)).toBeLessThan(tol);
          expect(Math.abs(back.y - q.y)).toBeLessThan(tol);
        }
      )
    );
  });

  it("makes a convex image quad that contains exactly the projected pixels", () => {
    assert(
      property(
        stateArb,
        perspectiveArb,
        num(0, 1),
        num(0, 1),
        (s0, p, u, v) => {
          const s = withPerspective(s0, p);

          pre(isPerspectiveValid(s.image, s.perspective));
          const quad = imageQuad(s);
          const cross = quad.map((a, i) => {
            const b = quad[(i + 1) % 4] ?? a;
            const c = quad[(i + 2) % 4] ?? a;

            return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
          });

          expect(
            cross.every((c) => c > 0) || cross.every((c) => c < 0)
          ).toBeTruthy();

          const planes = imagePlanes(s);
          const tol = 1e-9 * Math.max(s.image.width, s.image.height);

          expect(
            insidePlanes(
              planes,
              sourceToWorking(s, {
                x: u * s.image.width,
                y: v * s.image.height,
              }),
              tol
            )
          ).toBeTruthy();

          const outside = sourceToWorking(s, {
            x: -0.01 * s.image.width - 1,
            y: v * s.image.height,
          });

          expect(insidePlanes(planes, outside, 0)).toBeFalsy();
        }
      )
    );
  });

  it("finds the exact minimum auto-zoom under perspective, checked in source pixels", () => {
    assert(
      property(
        stateArb,
        perspectiveArb,
        num(10, 2000),
        num(10, 2000),
        num(-0.3, 0.3),
        num(-0.3, 0.3),
        (s0, p, vw, vh, u, v) => {
          const s = withPerspective(s0, p);

          pre(isPerspectiveValid(s.image, s.perspective));
          const planes = imagePlanes(s);
          const span = spanOf(imageQuad(s));
          const m = { x: u * span * 0.5, y: v * span * 0.5 };

          pre(insidePlanes(planes, m, -1e-3 * span));
          const k = minScaleAt(planes, { height: vh, width: vw }, m);
          const at = (scale: number): CropState => ({
            ...s,
            crop: { height: vh / scale, width: vw / scale, x: m.x, y: m.y },
          });

          expect(isCropCovered(at(k), 1e-9)).toBeTruthy();
          expect(isCropCovered(at(k * 0.999), 0)).toBeFalsy();
        }
      )
    );
  });

  it("finds the largest crop under perspective with the 3-variable LP", () => {
    assert(
      property(
        stateArb,
        perspectiveArb,
        num(10, 2000),
        num(10, 2000),
        array(tuple(num(-1, 1), num(-1, 1)), { maxLength: 30, minLength: 30 }),
        (s0, p, vw, vh, samples) => {
          const s = withPerspective(s0, p);

          pre(isPerspectiveValid(s.image, s.perspective));
          const planes = imagePlanes(s);
          const view = { height: vh, width: vw };
          const best = largestFit(planes, view);
          const fitted: CropState = {
            ...s,
            crop: {
              height: vh / best.scale,
              width: vw / best.scale,
              x: best.center.x,
              y: best.center.y,
            },
          };

          expect(isCropCovered(fitted, 1e-8)).toBeTruthy();
          const span = spanOf(imageQuad(s));
          const feasible = samples
            .map(([a, b]) => ({ x: a * span, y: b * span }))
            .filter((m) => insidePlanes(planes, m, -1e-9 * span));

          for (const m of feasible) {
            expect(minScaleAt(planes, view, m)).toBeGreaterThanOrEqual(
              best.scale * (1 - 1e-9)
            );
          }
        }
      )
    );
  });
});
