import {
  array,
  assert,
  constantFrom,
  double,
  pre,
  property,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";

import { coverScale } from "../../src/coverage";
import {
  applyMatrix2,
  cropCorners,
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
import type { CropState, Point } from "../../src/geometry";
import { angleArb, sizeArb, stateArb } from "./arbitraries";
import {
  clampPan,
  coverScaleAt,
  isCropCovered,
  largestCropAt,
  panBox,
} from "./oracles";

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
  it("covers with a pan inside the pan box and not just outside", () => {
    assert(
      property(
        stateArb,
        unit,
        unit,
        constantFrom<0 | 1 | 2 | 3>(0, 1, 2, 3),
        (s, u, v, side) => {
          const t = turnedSize(s.image, s.turns);
          const box = panBox(t, s.angle, s.crop.width, s.crop.height);

          pre(box.x > 1e-6 * t.width && box.y > 1e-6 * t.height);
          const m = applyMatrix2(rotationMatrix(s.angle), {
            x: u * box.x,
            y: v * box.y,
          });

          expect(isCropCovered(withCrop(s, m.x, m.y))).toBeTruthy();
          const outside: readonly [Point, Point, Point, Point] = [
            { x: box.x * 1.001 + 1e-3, y: v * box.y },
            { x: -box.x * 1.001 - 1e-3, y: v * box.y },
            { x: u * box.x, y: box.y * 1.001 + 1e-3 },
            { x: u * box.x, y: -box.y * 1.001 - 1e-3 },
          ];
          const mo = applyMatrix2(rotationMatrix(s.angle), outside[side]);

          expect(isCropCovered(withCrop(s, mo.x, mo.y), 0)).toBeFalsy();
        }
      )
    );
  });

  it("clamps to the closest covered pan and is idempotent", () => {
    assert(
      property(stateArb, wide, wide, (s, u, v) => {
        const t = turnedSize(s.image, s.turns);
        const want = { x: u * t.width, y: v * t.height };
        const c = clampPan(t, s.angle, s.crop.width, s.crop.height, want);

        expect(isCropCovered(withCrop(s, c.x, c.y))).toBeTruthy();
        const c2 = clampPan(t, s.angle, s.crop.width, s.crop.height, c);
        const tol = 1e-9 * Math.max(t.width, t.height);

        expect(Math.hypot(c2.x - c.x, c2.y - c.y)).toBeLessThanOrEqual(tol);
        const g = projectOntoPlanes(
          panPlanes(imagePlanes(s), s.crop.width, s.crop.height),
          want
        );

        expect(Math.hypot(g.x - c.x, g.y - c.y)).toBeLessThanOrEqual(
          1e-7 * Math.max(t.width, t.height)
        );
      })
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

  it("beats every sampled feasible pan with the clamp", () => {
    assert(
      property(
        stateArb,
        wide,
        wide,
        array(tuple(unit, unit), { maxLength: 20, minLength: 20 }),
        (s, u, v, samples) => {
          const t = turnedSize(s.image, s.turns);
          const want = { x: u * t.width, y: v * t.height };
          const c = clampPan(t, s.angle, s.crop.width, s.crop.height, want);
          const d = Math.hypot(c.x - want.x, c.y - want.y);
          const box = panBox(t, s.angle, s.crop.width, s.crop.height);

          for (const [p, q] of samples) {
            const m = applyMatrix2(rotationMatrix(s.angle), {
              x: p * box.x,
              y: q * box.y,
            });

            expect(
              Math.hypot(m.x - want.x, m.y - want.y)
            ).toBeGreaterThanOrEqual(d - 1e-9 * Math.max(t.width, t.height));
          }
        }
      )
    );
  });

  it("gives the exact minimum off-centre cover scale", () => {
    assert(
      property(stateArb, sizeArb, (s, view) => {
        const t = turnedSize(s.image, s.turns);
        const m = { x: s.crop.x, y: s.crop.y };
        const k = coverScaleAt(t, view, s.angle, m);
        const at = (scale: number): CropState =>
          withCrop(s, m.x, m.y, view.width / scale, view.height / scale);

        expect(isCropCovered(at(k), 1e-9)).toBeTruthy();
        expect(isCropCovered(at(k * 0.999), 0)).toBeFalsy();
        const g = minScaleAt(imagePlanes(s), view, m);

        expect(Math.abs(g - k) / k).toBeLessThan(1e-9);
      })
    );
  });

  it("equals coverScale when centred", () => {
    assert(
      property(sizeArb, sizeArb, angleArb, (image, view, a) => {
        const k = coverScaleAt(image, view, a, { x: 0, y: 0 });

        expect(
          Math.abs(k - coverScale(image, view, (a * Math.PI) / 180)) / k
        ).toBeLessThan(1e-12);
      })
    );
  });

  it("centres the largest crop of a given aspect and touches the image", () => {
    assert(
      property(stateArb, sizeArb, (s, view) => {
        const fit = largestFit(imagePlanes(s), view);
        const t = turnedSize(s.image, s.turns);
        const k = coverScaleAt(t, view, s.angle, { x: 0, y: 0 });

        expect(Math.abs(fit.scale - k) / k).toBeLessThan(1e-7);
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

  it("stays covered when lerping two covered rects, unlike a spring overshoot", () => {
    assert(
      property(
        stateArb,
        double({ max: 1, min: 0.05, noNaN: true }),
        double({ max: 1, min: 0.05, noNaN: true }),
        unit,
        unit,
        double({ max: 1, min: 0, noNaN: true }),
        (s, fw, fh, u, v, l) => {
          const t = turnedSize(s.image, s.turns);
          const w = s.crop.width * fw;
          const h = s.crop.height * fh;
          const box = panBox(t, s.angle, w, h);
          const m = applyMatrix2(rotationMatrix(s.angle), {
            x: u * box.x,
            y: v * box.y,
          });
          const o = withCrop(s, m.x, m.y, w, h);
          const planes = imagePlanes(s);
          const b = cropCorners(o.crop);
          const tol = 1e-9 * Math.max(t.width, t.height);

          for (const [i, a] of cropCorners(s.crop).entries()) {
            const bi = b[i] ?? a;

            expect(
              insidePlanes(
                planes,
                { x: a.x + (bi.x - a.x) * l, y: a.y + (bi.y - a.y) * l },
                tol
              )
            ).toBeTruthy();
          }
        }
      )
    );

    const s: CropState = {
      angle: 0,
      aspect: null,
      crop: { height: 50, width: 50, x: 0, y: 0 },
      flip: false,
      image: { height: 100, width: 100 },
      perspective: { focal: 1, horizontal: 0, vertical: 0 },
      turns: 0,
    };
    const over = 1.08;
    const c = {
      height: 50 + (100 - 50) * over,
      width: 50 + (100 - 50) * over,
      x: 0,
      y: 0,
    };

    expect(isCropCovered({ ...s, crop: c }, 0)).toBeFalsy();
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

describe("planes the cropper does not build", () => {
  const stretched = [
    { d: 600, nx: 2, ny: 0 },
    { d: 200, nx: -2, ny: 0 },
    { d: 200, nx: 0, ny: 2 },
    { d: 200, nx: 0, ny: -2 },
  ];
  const slanted = [
    { d: 100, nx: 1, ny: 0 },
    { d: 100, nx: -1, ny: 0 },
    { d: 200, nx: 0.6, ny: 0.8 },
    { d: -40, nx: -0.6, ny: -0.8 },
  ];

  it.each([
    ["normals that are not unit", stretched],
    ["sides that are not perpendicular", slanted],
  ])("fits a view inside %s", (_, planes) => {
    const view = { height: 10, width: 10 };
    const { center, scale } = largestFit(planes, view);

    expect(
      insidePlanes(
        panPlanes(planes, view.width / scale, view.height / scale),
        center,
        1e-6
      )
    ).toBeTruthy();
  });

  it("gives the scale of a stretched rectangle", () => {
    expect(
      largestFit(stretched, { height: 100, width: 100 }).scale
    ).toBeCloseTo(0.5, 9);
  });

  it("projects along the plane a point breaks", () => {
    const point = projectOntoPlanes(stretched, { x: 500, y: 0 });

    expect(point.x).toBeCloseTo(300, 9);
    expect(point.y).toBeCloseTo(0, 9);
  });

  it("finds the nearest point on a plane with a long normal", () => {
    const point = projectOntoPlanes(
      [
        { d: 0, nx: 3, ny: 4 },
        { d: 500, nx: 0, ny: -5 },
      ],
      { x: 100, y: 0 }
    );

    expect(point.x).toBeCloseTo(64, 9);
    expect(point.y).toBeCloseTo(-48, 9);
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
