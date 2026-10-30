import { double, assert as fcAssert, property, record } from "fast-check";
import { describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import {
  cropBox,
  cssMatrix,
  fitPlacement,
  imageMatrix,
  viewOf,
} from "../../src/dom/view";
import type { Layout } from "../../src/dom/view";
import {
  applyHomography,
  cropCorners,
  workingToSource,
} from "../../src/geometry";
import { fakeClock } from "../fake-clock";
import { stateArb } from "../geometry/arbitraries";

const layoutArb = record({
  height: double({ max: 2000, min: 100, noNaN: true }),
  inset: record({
    bottom: double({ max: 40, min: 0, noNaN: true }),
    left: double({ max: 40, min: 0, noNaN: true }),
    right: double({ max: 40, min: 0, noNaN: true }),
    top: double({ max: 40, min: 0, noNaN: true }),
  }),
  width: double({ max: 2000, min: 100, noNaN: true }),
}).map((l): Layout => ({ ...l, dpr: 1e9 }));

describe("view geometry", () => {
  it("fits the crop inside the inset box, centred", () => {
    fcAssert(
      property(stateArb, layoutArb, (state, layout) => {
        const box = cropBox(state, fitPlacement(layout, state), layout.dpr);
        const innerWidth =
          layout.width - layout.inset.left - layout.inset.right;
        const innerHeight =
          layout.height - layout.inset.top - layout.inset.bottom;
        expect(box.width).toBeLessThanOrEqual(innerWidth * (1 + 1e-9));
        expect(box.height).toBeLessThanOrEqual(innerHeight * (1 + 1e-9));
        expect(
          Math.max(box.width / innerWidth, box.height / innerHeight)
        ).toBeCloseTo(1, 6);
        expect(box.x + box.width / 2).toBeCloseTo(
          layout.inset.left + innerWidth / 2,
          4
        );
      })
    );
  });

  it("maps the crop corners of the photo onto the crop box", () => {
    fcAssert(
      property(
        stateArb,
        layoutArb,
        double({ max: 20, min: -20, noNaN: true }),
        double({ max: 20, min: -20, noNaN: true }),
        (base, layout, vertical, horizontal) => {
          const state = {
            ...base,
            perspective: {
              focal: 2 * Math.max(base.image.width, base.image.height),
              horizontal,
              vertical,
            },
          };
          const placement = fitPlacement(layout, state);
          const box = cropBox(state, placement, layout.dpr);
          const matrix = imageMatrix(state, placement);
          const expected = [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x + box.width, y: box.y + box.height },
            { x: box.x, y: box.y + box.height },
          ];
          for (const [i, corner] of cropCorners(state.crop).entries()) {
            const screen = applyHomography(
              matrix,
              workingToSource(state, corner)
            );
            const want = expected[i] ?? { x: 0, y: 0 };
            const tolerance = 1e-6 * Math.max(layout.width, layout.height);
            expect(Math.abs(screen.x - want.x)).toBeLessThan(tolerance);
            expect(Math.abs(screen.y - want.y)).toBeLessThan(tolerance);
          }
        }
      )
    );
  });

  it("snaps the crop box inward, so the hole never outgrows the photo", () => {
    fcAssert(
      property(
        stateArb,
        layoutArb,
        double({ max: 4, min: 1, noNaN: true }),
        (state, base, dpr) => {
          const layout = { ...base, dpr };
          const exact = cropBox(state, fitPlacement(layout, state), 1e9);
          const box = cropBox(state, fitPlacement(layout, state), dpr);
          expect(box.x).toBeGreaterThanOrEqual(exact.x - 1e-6);
          expect(box.y).toBeGreaterThanOrEqual(exact.y - 1e-6);
          expect(box.x + box.width).toBeLessThanOrEqual(
            exact.x + exact.width + 1e-6
          );
          expect(box.y + box.height).toBeLessThanOrEqual(
            exact.y + exact.height + 1e-6
          );
        }
      )
    );
  });

  it("snaps the crop box to device pixels", () => {
    const state = createCropper({
      clock: fakeClock().clock,
      image: { height: 777, width: 1001 },
    }).getCropState();
    if (!state) {
      throw new Error("no state");
    }
    const layout = {
      dpr: 3,
      height: 500.3,
      inset: { bottom: 11.1, left: 13.7, right: 7.2, top: 9.9 },
      width: 333.3,
    };
    const box = cropBox(state, fitPlacement(layout, state), 3);
    for (const v of [box.x, box.y, box.x + box.width, box.y + box.height]) {
      expect(Math.abs(v * 3 - Math.round(v * 3))).toBeLessThan(1e-9);
    }
  });

  it("writes a 2D matrix without perspective and a 3D one with it", () => {
    expect(cssMatrix([1, 0, 5, 0, 1, 6, 0, 0, 1])).toBe("matrix(1,0,0,1,5,6)");
    expect(cssMatrix([1, 0, 5, 0, 1, 6, 0.001, 0, 1])).toMatch(/^matrix3d\(/u);
  });
});

describe("view", () => {
  it("publishes a frame when the layout arrives and settles overscroll", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    const frames: number[] = [];
    view.onFrame((frame) => {
      frames.push(frame.matrix[2]);
    });
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    expect(frames).toHaveLength(1);
    const rest = frames[0] ?? 0;
    view.setOverscroll({ x: 40, y: 0 });
    time.frame();
    expect(frames.at(-1)).toBeCloseTo(rest + 40, 9);
    view.settleOverscroll();
    time.frames(60);
    expect(frames.at(-1)).toBeCloseTo(rest, 9);
    expect(time.pending()).toBe(0);
    view.destroy();
  });

  it("flips on the curve measured from iOS Photos", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    view.setOptions({ motion: "always" });
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    const rest = view.frame()?.matrix[0] ?? 1;
    const widths = new Map<number, number>();
    view.onFrame((frame) => {
      widths.set(Math.round(time.clock.now()), frame.matrix[0] / rest);
    });
    cropper.flip();
    const start = time.clock.now();
    time.frames(30, 1000 / 120);
    const at = (ms: number): number => {
      let best = 0;
      let gap = Number.POSITIVE_INFINITY;
      for (const [t, w] of widths) {
        if (Math.abs(t - start - ms) < gap) {
          gap = Math.abs(t - start - ms);
          best = w;
        }
      }
      return best;
    };
    expect(Math.abs(at(65) - 0.3)).toBeLessThan(0.17);
    expect(Math.abs(at(148) + 0.51)).toBeLessThan(0.12);
    expect(Math.abs(at(250) + 0.87)).toBeLessThan(0.06);
    view.destroy();
  });
});
