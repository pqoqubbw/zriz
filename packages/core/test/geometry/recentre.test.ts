import { assert, double, pre, property, record } from "fast-check";
import { describe, expect, it } from "vitest";

import { anchoredZoom, recentrePlan } from "../../src/geometry";
import type { ScreenRect, ViewTransform } from "../../src/geometry";

const num = (min: number, max: number) => double({ max, min, noNaN: true });
const rectArb = record({
  centerX: num(0, 1000),
  centerY: num(0, 1000),
  height: num(10, 800),
  width: num(10, 800),
});
const viewArb = record({
  scale: num(0.01, 50),
  translateX: num(-5000, 5000),
  translateY: num(-5000, 5000),
});
const targetArb = record({
  centerX: num(100, 900),
  centerY: num(100, 900),
  height: num(100, 1000),
  width: num(100, 1000),
});

const workingRect = (
  rect: ScreenRect,
  view: ViewTransform
): { x0: number; x1: number; y0: number; y1: number } => ({
  x0: (rect.centerX - rect.width / 2 - view.translateX) / view.scale,
  x1: (rect.centerX + rect.width / 2 - view.translateX) / view.scale,
  y0: (rect.centerY - rect.height / 2 - view.translateY) / view.scale,
  y1: (rect.centerY + rect.height / 2 - view.translateY) / view.scale,
});

const cropToScreen = (
  crop: { x: number; y: number; width: number; height: number },
  view: ViewTransform
): ScreenRect => ({
  centerX: crop.x * view.scale + view.translateX,
  centerY: crop.y * view.scale + view.translateY,
  height: crop.height * view.scale,
  width: crop.width * view.scale,
});

const cycleTarget = (i: number): ScreenRect => ({
  centerX: 512,
  centerY: 384,
  height: 700 - (i % 5),
  width: 900 + (i % 7),
});

describe("recentre", () => {
  it("keeps the same working-space rect on every frame, overshoot included", () => {
    assert(
      property(
        rectArb,
        viewArb,
        targetArb,
        num(-0.5, 1.5),
        (rect, view, target, l) => {
          const q0 = workingRect(rect, view);
          const frame = recentrePlan(rect, view, target).at(l);

          pre(frame.scale > 1e-3);
          const q = workingRect(frame.rect, frame.view);
          const scale = Math.max(
            Math.abs(q0.x0),
            Math.abs(q0.x1),
            Math.abs(q0.y0),
            Math.abs(q0.y1),
            1
          );

          for (const key of ["x0", "x1", "y0", "y1"] as const) {
            expect(Math.abs(q[key] - q0[key]) / scale).toBeLessThan(
              1e-9 / frame.scale
            );
          }
        }
      )
    );
  });

  it("is one scale about a fixed origin", () => {
    assert(
      property(
        rectArb,
        viewArb,
        targetArb,
        num(0, 1),
        (rect, view, target, l) => {
          const plan = recentrePlan(rect, view, target);

          pre(plan.origin !== null && Math.abs(1 - plan.factor) > 1e-3);
          const origin = plan.origin ?? { x: Number.NaN, y: Number.NaN };
          const frame = plan.at(l);
          const corner = {
            x: rect.centerX - rect.width / 2,
            y: rect.centerY - rect.height / 2,
          };
          const want = {
            x: origin.x + frame.scale * (corner.x - origin.x),
            y: origin.y + frame.scale * (corner.y - origin.y),
          };
          const got = {
            x: frame.rect.centerX - frame.rect.width / 2,
            y: frame.rect.centerY - frame.rect.height / 2,
          };
          const tol =
            1e-7 * Math.max(1, Math.abs(origin.x), Math.abs(origin.y));

          expect(Math.abs(got.x - want.x)).toBeLessThan(tol);
          expect(Math.abs(got.y - want.y)).toBeLessThan(tol);
          const moved = {
            x: origin.x + frame.scale * (view.translateX - origin.x),
            y: origin.y + frame.scale * (view.translateY - origin.y),
          };

          expect(Math.abs(moved.x - frame.view.translateX)).toBeLessThan(
            tol * 10
          );

          expect(Math.abs(moved.y - frame.view.translateY)).toBeLessThan(
            tol * 10
          );
        }
      )
    );
  });

  it("ends centred and fitted", () => {
    assert(
      property(rectArb, viewArb, targetArb, (rect, view, target) => {
        const frame = recentrePlan(rect, view, target).at(1);

        expect(frame.rect.centerX).toBeCloseTo(target.centerX, 9);
        expect(frame.rect.centerY).toBeCloseTo(target.centerY, 9);

        expect(
          Math.min(
            Math.abs(frame.rect.width - target.width),
            Math.abs(frame.rect.height - target.height)
          )
        ).toBeLessThan(1e-9 * target.width + 1e-9);

        expect(frame.rect.width).toBeLessThanOrEqual(
          target.width * (1 + 1e-12)
        );

        expect(frame.rect.height).toBeLessThanOrEqual(
          target.height * (1 + 1e-12)
        );
      })
    );
  });

  it("does not drift the committed crop over a thousand drag-release-recentre cycles", () => {
    const start = {
      height: 777.777,
      width: 1234.5678,
      x: 12.345678,
      y: -98.7654321,
    };
    const crop = { ...start };
    let view = { scale: 0.4321, translateX: 512, translateY: 384 };

    for (let i = 0; i < 1000; i += 1) {
      ({ view } = recentrePlan(
        cropToScreen(crop, view),
        view,
        cycleTarget(i)
      ).at(1));
    }

    expect(crop).toStrictEqual(start);
    let naive = { ...start };

    view = { scale: 0.4321, translateX: 512, translateY: 384 };

    for (let i = 0; i < 1000; i += 1) {
      const frame = recentrePlan(
        cropToScreen(naive, view),
        view,
        cycleTarget(i)
      ).at(1);

      ({ view } = frame);

      naive = {
        height: frame.rect.height / view.scale,
        width: frame.rect.width / view.scale,
        x: (frame.rect.centerX - view.translateX) / view.scale,
        y: (frame.rect.centerY - view.translateY) / view.scale,
      };
    }

    const drift = Math.max(
      Math.abs(naive.x - start.x),
      Math.abs(naive.y - start.y),
      Math.abs(naive.width - start.width),
      Math.abs(naive.height - start.height)
    );

    expect(drift).toBeGreaterThan(0);
  });

  it("keeps the point under the fingers on an anchored zoom", () => {
    assert(
      property(
        num(-1000, 1000),
        num(-1000, 1000),
        num(0.01, 10),
        num(0.01, 10),
        num(-500, 500),
        num(-500, 500),
        (mx, my, s, s2, fx, fy) => {
          const before = { x: mx + fx / s, y: my + fy / s };
          const m2 = anchoredZoom({ x: mx, y: my }, s, s2, { x: fx, y: fy });

          expect(m2.x + fx / s2).toBeCloseTo(before.x, 6);
          expect(m2.y + fy / s2).toBeCloseTo(before.y, 6);
        }
      )
    );
  });
});
