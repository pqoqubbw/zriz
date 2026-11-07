import {
  assert,
  constantFrom,
  double,
  integer,
  pre,
  property,
  tuple,
} from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dragHandle,
  imagePlanes,
  insidePlanes,
  straightenLimit,
  turnedSize,
} from "../../src/geometry";
import type {
  CropHandle,
  CropState,
  HalfPlane,
  Point,
  Rect,
  Size,
} from "../../src/geometry";
import { stateArb } from "./arbitraries";
import { largestCropAt } from "./oracles";

const handleArb = constantFrom<CropHandle>(
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw"
);
const pointerArb = tuple(
  double({ max: 2, min: -2, noNaN: true }),
  double({ max: 2, min: -2, noNaN: true })
);

const toRect = (s: CropState): Rect => ({
  x0: s.crop.x - s.crop.width / 2,
  x1: s.crop.x + s.crop.width / 2,
  y0: s.crop.y - s.crop.height / 2,
  y1: s.crop.y + s.crop.height / 2,
});

const rectPoints = (r: Rect): Point[] => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
];

const limitsFor = (
  s: CropState,
  minFraction: number
): {
  turned: Size;
  planes: HalfPlane[];
  minWidth: number;
  minHeight: number;
  tolerance: number;
} => {
  const turned = turnedSize(s.image, s.turns);
  const minWidth = Math.min(s.crop.width, s.crop.height) * minFraction;

  return {
    minHeight: minWidth,
    minWidth,
    planes: imagePlanes(s),
    tolerance: 1e-8 * Math.max(turned.width, turned.height),
    turned,
  };
};

const pick = (
  handle: CropHandle,
  letter: string,
  moved: number,
  kept: number
): number => (handle.includes(letter) ? moved : kept);

describe("handle drag constraints", () => {
  it("keeps free drags inside the image and above min size, moving only their edges", () => {
    assert(
      property(
        stateArb,
        handleArb,
        pointerArb,
        double({ max: 1, min: 0, noNaN: true }),
        (s, h, [u, v], minFraction) => {
          const { turned, planes, minWidth, minHeight, tolerance } = limitsFor(
            s,
            minFraction
          );
          const start = toRect(s);
          const r = dragHandle(
            start,
            h,
            { x: u * turned.width, y: v * turned.height },
            { aspect: null, minHeight, minWidth, planes }
          );

          for (const p of rectPoints(r)) {
            expect(insidePlanes(planes, p, tolerance)).toBeTruthy();
          }

          expect(r.x1 - r.x0).toBeGreaterThanOrEqual(minWidth - tolerance);
          expect(r.y1 - r.y0).toBeGreaterThanOrEqual(minHeight - tolerance);

          expect([r.x0, r.x1, r.y0, r.y1]).toStrictEqual([
            pick(h, "w", r.x0, start.x0),
            pick(h, "e", r.x1, start.x1),
            pick(h, "n", r.y0, start.y0),
            pick(h, "s", r.y1, start.y1),
          ]);
        }
      )
    );
  });

  it("follows a feasible pointer exactly", () => {
    assert(
      property(stateArb, handleArb, (s, h) => {
        const { planes } = limitsFor(s, 0);
        const start = toRect(s);
        const p = {
          x:
            (start.x0 + start.x1) / 2 +
            (h.includes("e") ? 0.25 : -0.25) * s.crop.width,
          y:
            (start.y0 + start.y1) / 2 +
            (h.includes("s") ? 0.25 : -0.25) * s.crop.height,
        };
        const r = dragHandle(start, h, p, {
          aspect: null,
          minHeight: 0,
          minWidth: 0,
          planes,
        });

        expect(r.x1).toBe(pick(h, "e", p.x, r.x1));
        expect(r.x0).toBe(pick(h, "w", p.x, r.x0));
        expect(r.y1).toBe(pick(h, "s", p.y, r.y1));
        expect(r.y0).toBe(pick(h, "n", p.y, r.y0));
      })
    );
  });

  it("keeps the aspect, the anchor and coverage on aspect-locked drags", () => {
    assert(
      property(
        stateArb,
        handleArb,
        pointerArb,
        double({ max: 1, min: 0, noNaN: true }),
        (s, h, [u, v], minFraction) => {
          const { turned, planes, minWidth, minHeight, tolerance } = limitsFor(
            s,
            minFraction
          );
          const aspect = s.crop.width / s.crop.height;
          const start = toRect(s);
          const limits = { aspect, minHeight, minWidth, planes };
          const r = dragHandle(
            start,
            h,
            { x: u * turned.width, y: v * turned.height },
            limits
          );
          const width = r.x1 - r.x0;
          const height = r.y1 - r.y0;

          expect(Math.abs(width - aspect * height)).toBeLessThanOrEqual(
            tolerance + 1e-12 * width
          );

          for (const p of rectPoints(r)) {
            expect(insidePlanes(planes, p, tolerance)).toBeTruthy();
          }

          expect(height).toBeGreaterThanOrEqual(minHeight - tolerance);
          const cx = (start.x0 + start.x1) / 2;
          const cy = (start.y0 + start.y1) / 2;
          const onCentre = (low: number, high: number, c: number): boolean =>
            Math.abs((low + high) / 2 - c) <= tolerance;
          const anchors: Record<CropHandle, readonly boolean[]> = {
            e: [r.x0 === start.x0, onCentre(r.y0, r.y1, cy)],
            n: [r.y1 === start.y1, onCentre(r.x0, r.x1, cx)],
            ne: [r.x0 === start.x0, r.y1 === start.y1],
            nw: [r.x1 === start.x1, r.y1 === start.y1],
            s: [r.y0 === start.y0, onCentre(r.x0, r.x1, cx)],
            se: [r.x0 === start.x0, r.y0 === start.y0],
            sw: [r.x1 === start.x1, r.y0 === start.y0],
            w: [r.x1 === start.x1, onCentre(r.y0, r.y1, cy)],
          };

          expect(anchors[h].every(Boolean)).toBeTruthy();
          const far = dragHandle(
            start,
            h,
            {
              x: start.x0 + (h.includes("w") ? -1e9 : 1e9),
              y: start.y0 + (h.includes("n") ? -1e9 : 1e9),
            },
            { ...limits, minHeight: 0, minWidth: 0 }
          );
          const slack = Math.min(
            ...rectPoints(far).flatMap((p) =>
              planes.map((plane) => plane.d - (plane.nx * p.x + plane.ny * p.y))
            )
          );

          expect(slack).toBeLessThanOrEqual(tolerance * 10);
        }
      )
    );
  });

  it("leaves a crop under its minimum alone at zero motion and never turns it inside out", () => {
    assert(
      property(
        stateArb,
        handleArb,
        pointerArb,
        double({ max: 4, min: 1.01, noNaN: true }),
        constantFrom(null, "shape"),
        (s, h, [u, v], minFraction, locked) => {
          const { turned, planes, tolerance } = limitsFor(s, 0);
          const start = toRect(s);
          const limits = {
            aspect: locked ? s.crop.width / s.crop.height : null,
            minHeight: s.crop.height * minFraction,
            minWidth: s.crop.width * minFraction,
            planes,
          };
          const edge = {
            x: h.includes("e") ? start.x1 : start.x0,
            y: h.includes("s") ? start.y1 : start.y0,
          };
          const still = dragHandle(
            start,
            h,
            locked
              ? {
                  x: h.includes("e") || h.includes("w") ? edge.x : 0,
                  y: h.includes("n") || h.includes("s") ? edge.y : 0,
                }
              : edge,
            limits
          );

          for (const key of ["x0", "x1", "y0", "y1"] as const) {
            expect(Math.abs(still[key] - start[key])).toBeLessThanOrEqual(
              tolerance
            );
          }

          const r = dragHandle(
            start,
            h,
            { x: u * turned.width, y: v * turned.height },
            limits
          );

          expect(r.x1 - r.x0).toBeGreaterThanOrEqual(s.crop.width - tolerance);
          expect(r.y1 - r.y0).toBeGreaterThanOrEqual(s.crop.height - tolerance);
        }
      ),
      {
        examples: [
          [
            {
              angle: 5.729609925614628e-7,
              aspect: null,
              crop: {
                height: 2265.9999977339835,
                width: 226.5999997733984,
                x: 0,
                y: 0,
              },
              flip: false,
              image: { height: 227, width: 2266 },
              perspective: { focal: 1, horizontal: 0, vertical: 0 },
              turns: 3,
            },
            "se",
            [0, 0],
            1.01,
            "shape",
          ],
        ],
      }
    );
  });

  it("stays monotone in the pointer", () => {
    assert(
      property(stateArb, (s) => {
        const { planes } = limitsFor(s, 0);
        const start = toRect(s);
        const limits = { aspect: null, minHeight: 0, minWidth: 0, planes };
        const edges = Array.from({ length: 51 }, (_, i) => {
          const x = start.x1 + (i / 50) * s.image.width * 2;

          return dragHandle(start, "e", { x, y: 0 }, limits).x1;
        });

        for (const [i, edge] of edges.entries()) {
          expect(edge).toBeGreaterThanOrEqual(
            (edges[i - 1] ?? Number.NEGATIVE_INFINITY) - 1e-9 * s.image.width
          );
        }
      })
    );
  });

  it.each([
    [
      "passes a plane",
      {
        angle: 3.749924182617662e-11,
        crop: { height: 1194, width: 119.4, x: 0, y: 0 },
        image: { height: 6232, width: 1194 },
      },
      [3000],
      3000,
    ],
    [
      "stops at a plane without a jump back",
      {
        angle: -5.729577951308234e-8,
        crop: { height: 0.9999999979, width: 0.09999999979, x: 0, y: 0 },
        image: { height: 7, width: 1 },
      },
      [1.05, 1.5, 2.01, 2.05],
      1.05,
    ],
  ])(
    "%s that a near-zero angle leaves almost parallel to the drag",
    (_name, shape, pointers, last) => {
      const s = {
        ...shape,
        aspect: null,
        flip: false,
        perspective: { focal: 1, horizontal: 0, vertical: 0 },
        turns: 3 as const,
      };
      const { planes } = limitsFor(s, 0);
      const start = toRect(s);
      const limits = { aspect: null, minHeight: 0, minWidth: 0, planes };
      const edges = pointers.map(
        (x) => dragHandle(start, "e", { x, y: 0 }, limits).x1
      );

      for (const [i, edge] of edges.entries()) {
        expect(edge).toBeGreaterThanOrEqual(
          edges[i - 1] ?? Number.NEGATIVE_INFINITY
        );
      }

      expect(edges.at(-1)).toBeCloseTo(last, 6);
    }
  );

  it("keeps the minimum size when the planes leave no strictly feasible corner", () => {
    const s = {
      angle: 2.5581246702340123e-10,
      aspect: null,
      crop: {
        height: 0.9999999999955342,
        width: 0.9999999999955342,
        x: -2240.2574999999965,
        y: -1.000223406877332e-8,
      },
      flip: false,
      image: { height: 4486, width: 1 },
      perspective: { focal: 1, horizontal: 0, vertical: 0 },
      turns: 3 as const,
    };
    const { minHeight, minWidth, planes, tolerance } = limitsFor(
      s,
      0.9999999999999989
    );
    const r = dragHandle(
      toRect(s),
      "nw",
      { x: 0, y: 0 },
      { aspect: null, minHeight, minWidth, planes }
    );

    expect(r.x1 - r.x0).toBeGreaterThanOrEqual(minWidth - tolerance);
    expect(r.y1 - r.y0).toBeGreaterThanOrEqual(minHeight - tolerance);
  });

  it("gives the exact straighten limit for a minimum crop size", () => {
    assert(
      property(
        integer({ max: 50, min: 1 }),
        integer({ max: 10_000, min: 1 }),
        integer({ max: 40, min: 1 }),
        (width, height, minPx) => {
          const image = { height, width };
          const limit = straightenLimit(image, minPx, minPx);

          pre(limit > 0 && limit < 45);
          const ok = largestCropAt(image, limit * 0.999, 1, { x: 0, y: 0 });

          expect(ok.height).toBeGreaterThanOrEqual(minPx * (1 - 1e-6));
          const bad = largestCropAt(
            image,
            Math.min(45, limit * 1.01 + 1e-6),
            1,
            { x: 0, y: 0 }
          );

          expect(bad.height).toBeLessThan(minPx);
        }
      )
    );

    expect(straightenLimit({ height: 10_000, width: 1 }, 1, 1)).toBe(0);
    expect(straightenLimit({ height: 3000, width: 4000 }, 1, 1)).toBe(45);
  });
});
