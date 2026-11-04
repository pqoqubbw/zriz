import {
  assert,
  asyncProperty,
  constantFrom,
  double,
  integer,
  pre,
  property,
} from "fast-check";
import sharp from "sharp";
import type { Sharp } from "sharp";
import { describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import {
  applyAffine,
  applyHomography,
  applyMatrix2,
  exifOrientations,
  exportPlan,
  invertMatrix3,
  orientationMatrix,
  snapEdge,
  sourceToOutputMatrix,
} from "../../src/geometry";
import type { CropState, ExportPlan, PixelRect } from "../../src/geometry";
import { toSharp } from "../../src/to-sharp";
import { stateArb } from "./arbitraries";
import { runSharp } from "./run-sharp";

const isPlan = (value: object): value is ExportPlan => "forward" in value;

const corners = (r: PixelRect): [number, number][] => [
  [r.left, r.top],
  [r.left + r.width, r.top],
  [r.left + r.width, r.top + r.height],
  [r.left, r.top + r.height],
];

const coordinateImage = (width: number, height: number): Sharp => {
  const buffer = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      buffer[i] = x % 256;
      buffer[i + 1] = y % 256;
      buffer[i + 2] = Math.floor(x / 256) + Math.floor(y / 256) * 16;
    }
  }
  return sharp(buffer, { raw: { channels: 3, height, width } });
};

const blobImage = (
  width: number,
  height: number,
  px: number,
  py: number,
  sigma = 2
): Sharp => {
  const buffer = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      buffer[y * width + x] = Math.round(
        255 *
          Math.exp(
            -((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2) / (2 * sigma * sigma)
          )
      );
    }
  }
  return sharp(buffer, { raw: { channels: 1, height, width } });
};

const centroid = async (
  image: Sharp
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const value = data[(y * info.width + x) * info.channels] ?? 0;
      sum += value;
      sumX += value * (x + 0.5);
      sumY += value * (y + 0.5);
    }
  }
  return {
    height: info.height,
    width: info.width,
    x: sumX / sum,
    y: sumY / sum,
  };
};

describe("export plan", () => {
  it("samples every exported pixel inside the source image", () => {
    assert(
      property(stateArb, constantFrom(1, 0.5, 0.25, 2), (s, scale) => {
        const plan = exportPlan(s, scale);
        const tol = 1e-7 * Math.max(s.image.width, s.image.height);
        for (const [x, y] of [
          [0, 0],
          [plan.width, 0],
          [plan.width, plan.height],
          [0, plan.height],
        ] as const) {
          const p = applyAffine(plan.inverse, { x, y });
          expect(p.x).toBeGreaterThanOrEqual(-tol);
          expect(p.y).toBeGreaterThanOrEqual(-tol);
          expect(p.x).toBeLessThanOrEqual(s.image.width + tol);
          expect(p.y).toBeLessThanOrEqual(s.image.height + tol);
        }
      })
    );
  });

  it("maps an integer pixel rect exactly with no straighten", () => {
    assert(
      property(stateArb, (s0) => {
        const s = { ...s0, angle: 0 };
        const plan = exportPlan(s);
        expect(plan.pixelRect).not.toBeNull();
        const r = plan.pixelRect ?? { height: 0, left: 0, top: 0, width: 0 };
        for (const v of [r.left, r.top, r.width, r.height]) {
          expect(Number.isInteger(v)).toBeTruthy();
        }
        expect(r.left + r.width).toBeLessThanOrEqual(s.image.width);
        expect(r.top + r.height).toBeLessThanOrEqual(s.image.height);
        expect(r.width).toBeGreaterThanOrEqual(1);
        for (const [x, y] of corners(r)) {
          const o = applyAffine(plan.forward, { x, y });
          expect([0, plan.width]).toContain(Math.round(o.x * 1e9) / 1e9 + 0);
          expect([0, plan.height]).toContain(Math.round(o.y * 1e9) / 1e9 + 0);
        }
      })
    );
  });

  it("snaps edges stably under float noise", () => {
    assert(
      property(
        integer({ max: 100_000, min: 0 }),
        double({ max: 1e-7, min: -1e-7, noNaN: true }),
        (n, e) => {
          expect(snapEdge(n + e)).toBe(n);
          expect(snapEdge(n + 0.5 + e)).toBe(n + 1);
        }
      )
    );
  });
});

describe("export plan scale", () => {
  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], [0], [-1]])(
    "falls back to scale 1 for %d",
    (scale) => {
      assert(
        property(stateArb, (s) => {
          expect(exportPlan(s, scale)).toStrictEqual(exportPlan(s));
        })
      );
    }
  );
});

describe("export plan with perspective", () => {
  it("composes forward and homography around the image centre", () => {
    const state: CropState = {
      angle: 3,
      aspect: null,
      crop: { height: 500, width: 700, x: 20, y: -10 },
      flip: false,
      image: { height: 1201, width: 1601 },
      perspective: { focal: 1156, horizontal: -9, vertical: 12 },
      turns: 1,
    };
    const plan = exportPlan(state);
    if (!plan.homography) {
      throw new Error("no homography");
    }
    const centre = { x: 800.5, y: 600.5 };
    const whole = sourceToOutputMatrix(state, {
      ...plan,
      crop: state.crop,
      scale: 1,
    });
    const point = { x: 300, y: 900 };
    const warped = applyHomography(plan.homography, {
      x: point.x - centre.x,
      y: point.y - centre.y,
    });
    const output = applyAffine(plan.forward, {
      x: centre.x + warped.x,
      y: centre.y + warped.y,
    });
    const expected = applyHomography(whole, point);
    expect(output.x).toBeCloseTo(expected.x, 6);
    expect(output.y).toBeCloseTo(expected.y, 6);
    const back = applyAffine(plan.inverse, output);
    const unwarped = applyHomography(invertMatrix3(plan.homography), {
      x: back.x - centre.x,
      y: back.y - centre.y,
    });
    expect(centre.x + unwarped.x).toBeCloseTo(point.x, 6);
    expect(centre.y + unwarped.y).toBeCloseTo(point.y, 6);
  });
});

describe(toSharp, () => {
  it("reproduces the axis-aligned export pixel for pixel", async () => {
    await assert(
      asyncProperty(
        stateArb,
        integer({ max: 300, min: 1 }),
        integer({ max: 300, min: 1 }),
        async (s0, width, height) => {
          const turned =
            s0.turns % 2 ? { height: width, width: height } : { height, width };
          const s: CropState = {
            ...s0,
            angle: 0,
            crop: {
              height: turned.height * 0.6 + 0.2,
              width: turned.width * 0.5 + 0.3,
              x: turned.width * 0.1,
              y: -turned.height * 0.05,
            },
            image: { height, width },
          };
          const plan = exportPlan(s);
          const output = await runSharp(
            coordinateImage(width, height),
            plan,
            s.image
          );
          const { data, info } = await output
            .raw()
            .toBuffer({ resolveWithObject: true });
          expect([info.width, info.height]).toStrictEqual([
            plan.width,
            plan.height,
          ]);
          for (let y = 0; y < info.height; y += 1) {
            for (let x = 0; x < info.width; x += 1) {
              const p = applyAffine(plan.inverse, { x: x + 0.5, y: y + 0.5 });
              const i = (y * info.width + x) * info.channels;
              const high = data[i + 2] ?? 0;
              const sx = (data[i] ?? 0) + (high % 16) * 256;
              const sy = (data[i + 1] ?? 0) + Math.floor(high / 16) * 256;
              expect([sx, sy]).toStrictEqual([
                Math.floor(p.x),
                Math.floor(p.y),
              ]);
            }
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it("reproduces a straightened export to a twentieth of a pixel", async () => {
    let ran = 0;
    await assert(
      asyncProperty(
        stateArb,
        integer({ max: 160, min: 40 }),
        integer({ max: 160, min: 40 }),
        double({ max: 2, min: 0.5, noNaN: true }),
        async (s0, width, height, scale) => {
          pre(Math.abs(s0.angle) > 0.01);
          const turned =
            s0.turns % 2 ? { height: width, width: height } : { height, width };
          const radians = (Math.abs(s0.angle) * Math.PI) / 180;
          const cos = Math.cos(radians);
          const sin = Math.sin(radians);
          const k = Math.max(
            (turned.width * cos + turned.height * sin) / turned.width,
            (turned.width * sin + turned.height * cos) / turned.height
          );
          const s: CropState = {
            ...s0,
            crop: {
              height: turned.height / k,
              width: turned.width / k,
              x: 0,
              y: 0,
            },
            image: { height, width },
          };
          const plan = exportPlan(s, scale);
          const source = {
            x:
              width / 2 +
              (s0.crop.x / Math.max(1, s0.image.width)) * width * 0.1,
            y: height / 2 + 3.3,
          };
          const want = applyAffine(plan.forward, source);
          pre(
            want.x > 8 * scale &&
              want.y > 8 * scale &&
              want.x < plan.width - 8 * scale &&
              want.y < plan.height - 8 * scale
          );
          ran += 1;
          const got = await centroid(
            await runSharp(
              blobImage(width, height, source.x, source.y),
              plan,
              s.image
            )
          );
          expect([got.width, got.height]).toStrictEqual([
            plan.width,
            plan.height,
          ]);
          expect(Math.abs(got.x - want.x)).toBeLessThan(
            0.05 * Math.max(1, scale)
          );
          expect(Math.abs(got.y - want.y)).toBeLessThan(
            0.05 * Math.max(1, scale)
          );
        }
      ),
      { numRuns: 300 }
    );
    expect(ran).toBeGreaterThanOrEqual(30);
  });

  it("cuts at the planned size at every low scale", async () => {
    await assert(
      asyncProperty(
        integer({ max: 640, min: 40 }),
        integer({ max: 640, min: 40 }),
        double({ max: 3, min: -3, noNaN: true }),
        double({ max: 0.5, min: 0.05, noNaN: true }),
        constantFrom(-1, 1),
        async (width, height, rotation, scale, side) => {
          const image = { height, width };
          const cropper = createCropper({
            defaultValue: {
              center: { x: 0.5 + side * 0.4, y: 0.5 + side * 0.4 },
              rotation,
              size: { height: 0.3, width: 0.3 },
            },
            image,
          });
          const plan = cropper.getPixelCrop(scale);
          pre(plan !== null && plan.pixelRect === null);
          const output = await runSharp(
            sharp({
              create: { background: "#808080", channels: 3, ...image },
            }),
            plan,
            image
          );
          const { info } = await output
            .raw()
            .toBuffer({ resolveWithObject: true });
          expect([info.width, info.height]).toStrictEqual([
            plan.width,
            plan.height,
          ]);
        }
      ),
      { numRuns: 400 }
    );
  });

  it("accepts every plan the store makes", () => {
    assert(
      property(
        integer({ max: 20_000, min: 1 }),
        integer({ max: 20_000, min: 1 }),
        double({ max: 45, min: -45, noNaN: true }),
        double({ max: 1, min: 0.001, noNaN: true }),
        double({ max: 2, min: 1e-6, noNaN: true }),
        constantFrom(0, 1, 2, 3),
        (width, height, rotation, size, scale, quarterTurns) => {
          const image = { height, width };
          const cropper = createCropper({
            defaultValue: {
              mirrored: quarterTurns > 1,
              quarterTurns,
              rotation,
              size: { height: size, width: size },
            },
            image,
          });
          const plan = cropper.getPixelCrop(scale);
          pre(plan !== null);
          expect(() => toSharp(plan, image)).not.toThrow();
        }
      )
    );
  });

  it("refuses a plan the store could not have made", () => {
    const image = { height: 64, width: 64 };
    const cropper = createCropper({
      defaultValue: { rotation: 10 },
      image,
    });
    const plan = cropper.getPixelCrop();
    if (!plan) {
      throw new Error("no plan");
    }
    const refused: Record<string, unknown>[] = [
      { forward: [1, 0, 0, 1, 0] },
      { forward: 5 },
      { forward: null },
      { forward: "abcdef" },
      { forward: { length: 6 } },
      { forward: [Number.NaN, 0, 0, 1, 0, 0] },
      { forward: [1, 0, 0, 1, Number.POSITIVE_INFINITY, 0] },
      { forward: [0, 0, 0, 0, 0, 0] },
      { forward: [3, 0, 0, 1, 0, 0] },
      { forward: [1, 0, 3, 1, 0, 0] },
      { forward: [1e-3, 0, 0, 1e-3, 0, 0] },
      { width: 0 },
      { height: -1 },
      { width: 10.5 },
      { height: Number.NaN },
    ];
    for (const forged of refused) {
      const changed = { ...plan, ...forged };
      if (!isPlan(changed)) {
        throw new Error("not a plan");
      }
      expect(() => toSharp(changed, image)).toThrow(RangeError);
    }
  });

  it("matches the EXIF orientation table with sharp auto-orient", async () => {
    const width = 60;
    const height = 40;
    const px = 17.3;
    const py = 11.8;
    const results = await Promise.all(
      Object.entries(exifOrientations).map(async ([tag, { turns, flip }]) => {
        const jpeg = await blobImage(width, height, px, py, 2.5)
          .jpeg({ quality: 100 })
          .withMetadata({ orientation: Number(tag) })
          .toBuffer();
        const got = await centroid(sharp(jpeg).rotate());
        const out =
          turns % 2 ? { height: width, width: height } : { height, width };
        const v = applyMatrix2(orientationMatrix(turns, flip), {
          x: px - width / 2,
          y: py - height / 2,
        });
        return { got, out, v };
      })
    );
    for (const { got, out, v } of results) {
      expect([got.width, got.height]).toStrictEqual([out.width, out.height]);
      expect(Math.abs(got.x - (v.x + out.width / 2))).toBeLessThan(0.15);
      expect(Math.abs(got.y - (v.y + out.height / 2))).toBeLessThan(0.15);
    }
  });
});
