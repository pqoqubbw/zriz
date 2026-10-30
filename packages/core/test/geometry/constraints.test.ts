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
  aspectHeightRange,
  dragHandle,
  imagePlanes,
  insidePlanes,
  largestCropAt,
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
          const { min, max } = aspectHeightRange(start, h, limits);
          pre(min <= max);
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
          const anchors: Record<CropHandle, readonly unknown[]> = {
            e: [
              r.x0 === start.x0,
              Math.abs((r.y0 + r.y1) / 2 - cy) <= tolerance,
            ],
            n: [
              r.y1 === start.y1,
              Math.abs((r.x0 + r.x1) / 2 - cx) <= tolerance,
            ],
            ne: [],
            nw: [r.x1 === start.x1, r.y1 === start.y1],
            s: [],
            se: [r.x0 === start.x0, r.y0 === start.y0],
            sw: [],
            w: [],
          };
          expect(anchors[h].every(Boolean)).toBeTruthy();
        }
      )
    );
  });

  it("touches the image at the top of the aspect range", () => {
    assert(
      property(stateArb, handleArb, (s, h) => {
        const { planes, tolerance } = limitsFor(s, 0);
        const aspect = s.crop.width / s.crop.height;
        const start = toRect(s);
        const limits = { aspect, minHeight: 0, minWidth: 0, planes };
        const { max } = aspectHeightRange(start, h, limits);
        const far = {
          x: start.x0 + (h.includes("w") ? -1e9 : 1e9),
          y: start.y0 + (h.includes("n") ? -1e9 : 1e9),
        };
        const r = dragHandle(start, h, far, limits);
        expect(r.y1 - r.y0).toBeCloseTo(max, 6);
        const slack = Math.min(
          ...rectPoints(r).flatMap((p) =>
            planes.map((plane) => plane.d - (plane.nx * p.x + plane.ny * p.y))
          )
        );
        expect(slack).toBeLessThanOrEqual(tolerance * 10);
      })
    );
  });

  it("never jumps and stays monotone in the pointer while rubber-banding", () => {
    assert(
      property(stateArb, (s) => {
        const { planes } = limitsFor(s, 0);
        const start = toRect(s);
        const limits = { aspect: null, minHeight: 0, minWidth: 0, planes };
        const edges = Array.from({ length: 51 }, (_, i) => {
          const x = start.x1 + (i / 50) * s.image.width * 2;
          return dragHandle(start, "e", { x, y: 0 }, limits, s.crop.width).x1;
        });
        for (const [i, edge] of edges.entries()) {
          expect(edge).toBeGreaterThanOrEqual(
            edges[i - 1] ?? Number.NEGATIVE_INFINITY
          );
        }
      })
    );
  });

  it("ignores planes that a near-zero angle leaves almost parallel to the drag", () => {
    const s = {
      angle: 3.749924182617662e-11,
      aspect: null,
      crop: { height: 1194, width: 119.4, x: 0, y: 0 },
      flip: false,
      image: { height: 6232, width: 1194 },
      perspective: { focal: 1, horizontal: 0, vertical: 0 },
      turns: 3 as const,
    };
    const { planes } = limitsFor(s, 0);
    const start = toRect(s);
    const limits = { aspect: null, minHeight: 0, minWidth: 0, planes };
    expect(dragHandle(start, "e", { x: 3000, y: 0 }, limits).x1).toBeCloseTo(
      3000,
      6
    );
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
