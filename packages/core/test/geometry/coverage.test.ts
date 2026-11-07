import { array, assert, double, pre, property, tuple } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyMatrix2,
  imagePlanes,
  insidePlanes,
  isFlatPerspective,
  largestFit,
  minScaleAt,
  panPlanes,
  projectOntoPlanes,
  rotationMatrix,
  turnedSize,
} from "../../src/geometry";
import type { CropState } from "../../src/geometry";
import { sizeArb, stateArb } from "./arbitraries";
import { isCropCovered, largestCropAt, panBox } from "./oracles";

const unit = double({ max: 1, min: -1, noNaN: true });
const wide = double({ max: 2, min: -2, noNaN: true });

const withCrop = (
  state: CropState,
  x: number,
  y: number,
  width = state.crop.width,
  height = state.crop.height
): CropState => ({ ...state, crop: { height, width, x, y } });

describe("coverage with pan", () => {
  it("clamps to the closest covered pan and is idempotent", () => {
    assert(
      property(
        stateArb,
        wide,
        wide,
        array(tuple(unit, unit), { maxLength: 20, minLength: 20 }),
        (s, u, v, samples) => {
          const t = turnedSize(s.image, s.turns);
          const tol = 1e-9 * Math.max(t.width, t.height);
          const planes = panPlanes(imagePlanes(s), s.crop.width, s.crop.height);
          const want = { x: u * t.width, y: v * t.height };
          const c = projectOntoPlanes(planes, want);

          expect(isCropCovered(withCrop(s, c.x, c.y))).toBeTruthy();
          const again = projectOntoPlanes(planes, c);

          expect(Math.hypot(again.x - c.x, again.y - c.y)).toBeLessThanOrEqual(
            tol
          );

          const d = Math.hypot(c.x - want.x, c.y - want.y);
          const box = panBox(t, s.angle, s.crop.width, s.crop.height);

          const covered = samples
            .map(([p, q]) =>
              applyMatrix2(rotationMatrix(s.angle), {
                x: p * box.x,
                y: q * box.y,
              })
            )
            .filter((m) => insidePlanes(planes, m, 0));

          for (const m of covered) {
            expect(
              Math.hypot(m.x - want.x, m.y - want.y)
            ).toBeGreaterThanOrEqual(d - tol);
          }
        }
      )
    );
  });

  it("keeps the free axis of a pan far past a crop with little room", () => {
    const n = Math.SQRT1_2;
    const { x, y } = projectOntoPlanes(
      [
        { d: 1, nx: n, ny: n },
        { d: 1, nx: -n, ny: -n },
        { d: 1, nx: -n, ny: n },
        { d: 1, nx: n, ny: -n },
      ],
      { x: (5000 - 0.5) * n, y: (5000 + 0.5) * n }
    );

    expect((x + y) * n).toBeCloseTo(1, 6);
    expect((y - x) * n).toBeCloseTo(0.5, 6);
  });

  it("gives the exact minimum off-centre cover scale", () => {
    assert(
      property(stateArb, sizeArb, (s, view) => {
        const m = { x: s.crop.x, y: s.crop.y };
        const k = minScaleAt(imagePlanes(s), view, m);
        const at = (scale: number): CropState =>
          withCrop(s, m.x, m.y, view.width / scale, view.height / scale);

        expect(isCropCovered(at(k), 1e-9)).toBeTruthy();
        expect(isCropCovered(at(k * 0.999), 0)).toBeFalsy();
      })
    );
  });

  it("centres the largest crop of a given aspect and touches the image", () => {
    assert(
      property(stateArb, sizeArb, (s, view) => {
        const fit = largestFit(imagePlanes(s), view);
        const t = turnedSize(s.image, s.turns);
        const k = fit.scale;

        expect(Math.hypot(fit.center.x, fit.center.y)).toBeLessThanOrEqual(
          1e-7 * Math.max(t.width, t.height)
        );

        const big = largestCropAt(t, s.angle, view.width / view.height, {
          x: 0,
          y: 0,
        });

        expect(Math.abs(big.width - view.width / k) / big.width).toBeLessThan(
          1e-9
        );

        expect(
          isCropCovered(withCrop(s, 0, 0, big.width, big.height))
        ).toBeTruthy();

        expect(
          isCropCovered(
            withCrop(s, 0, 0, big.width * 1.001, big.height * 1.001),
            0
          )
        ).toBeFalsy();
      })
    );
  });

  it("needs an infinite scale at a centre with no room", () => {
    const planes = [{ d: 50, nx: 1, ny: 0 }];
    const view = { height: 10, width: 10 };

    expect(minScaleAt(planes, view, { x: 50, y: 0 })).toBe(
      Number.POSITIVE_INFINITY
    );

    expect(minScaleAt(planes, view, { x: 60, y: 0 })).toBe(
      Number.POSITIVE_INFINITY
    );

    expect(minScaleAt(planes, view, { x: 0, y: 0 })).toBe(0.1);
  });

  it("never returns a negative zero centre", () => {
    const image = { height: 1000, width: 1000 };
    const state: CropState = {
      angle: 0,
      aspect: null,
      crop: { height: 500, width: 500, x: 0, y: 0 },
      flip: false,
      image,
      perspective: { focal: 700, horizontal: 0, vertical: 0 },
      turns: 0,
    };
    const { center } = largestFit(imagePlanes(state), state.crop);

    expect(Object.is(center.x, -0)).toBeFalsy();
    expect(Object.is(center.y, -0)).toBeFalsy();
  });
});

describe("largestFit on level planes", () => {
  it("agrees with the general solver", () => {
    assert(
      property(
        stateArb,
        double({ max: 4, min: 0.1, noNaN: true }),
        double({ max: 4, min: 0.1, noNaN: true }),
        (state, width, height) => {
          pre(isFlatPerspective(state.perspective));
          const planes = imagePlanes(state);
          const view = { height, width };
          const [first] = planes;
          const level = largestFit(planes, view);
          const solved = largestFit(
            [...planes, { ...(first ?? { d: 0, nx: 1, ny: 0 }) }],
            view
          );

          expect(level.scale).toBeCloseTo(solved.scale, 6);
        }
      )
    );
  });

  it("takes a view with no width on planes it can only touch", () => {
    const planes = panPlanes(
      imagePlanes({
        angle: 0,
        aspect: null,
        crop: { height: 10, width: 10, x: 0, y: 0 },
        flip: false,
        image: { height: 10, width: 10 },
        perspective: { focal: 10, horizontal: 0, vertical: 0 },
        turns: 0,
      }),
      10,
      0
    );

    expect(largestFit(planes, { height: 1, width: 0 }).scale).toBeCloseTo(
      0.1,
      9
    );
  });
});
