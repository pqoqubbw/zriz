import { double, assert as fcAssert, property } from "fast-check";
import { describe, expect, it } from "vitest";

import { decay, decayDistance, spring, velocityTracker } from "../src";

const integrate = (
  x0: number,
  v0: number,
  omega: number,
  zeta: number,
  ms: number
): number => {
  let x = x0;
  let v = v0;
  const dt = 1e-5;
  for (let t = 0; t < ms / 1000; t += dt) {
    const a = -2 * zeta * omega * v - omega * omega * x;
    v += a * dt;
    x += v * dt;
  }
  return x;
};

describe(spring, () => {
  it.each([
    ["critical", 1],
    ["under", 0.6],
    ["over", 1.4],
  ])("%s damping matches numeric integration", (_, zeta) => {
    const exact = spring(100, -300, 16.1, zeta, 120).value;
    expect(exact).toBeCloseTo(integrate(100, -300, 16.1, zeta, 120), 1);
  });

  it("starts at the given displacement and velocity", () => {
    for (const zeta of [0.6, 1, 1.4]) {
      const start = spring(42, 7, 20, zeta, 0);
      expect(start.value).toBeCloseTo(42, 10);
      expect(start.velocity).toBeCloseTo(7, 8);
    }
  });

  it("is the same through hitches as in one step", () => {
    fcAssert(
      property(
        double({ max: 500, min: -500, noNaN: true }),
        double({ max: 5000, min: -5000, noNaN: true }),
        double({ max: 200, min: 1, noNaN: true }),
        double({ max: 200, min: 1, noNaN: true }),
        (x0, v0, a, b) => {
          for (const zeta of [0.6, 1, 1.4]) {
            const mid = spring(x0, v0, 16.1, zeta, a);
            const split = spring(mid.value, mid.velocity, 16.1, zeta, b);
            const direct = spring(x0, v0, 16.1, zeta, a + b);
            expect(split.value).toBeCloseTo(direct.value, 6);
          }
        }
      )
    );
  });

  it("settles a recentre in about 0.39 s at omega 16.1", () => {
    expect(Math.abs(spring(1, 0, 16.1, 1, 390).value)).toBeLessThan(0.02);
  });
});

const travelAt = (hz: number): number => {
  let travelled = 0;
  let velocity = 1200;
  const step = 1000 / hz;
  for (let i = 0; i < hz; i += 1) {
    const next = decay(velocity, 95, step);
    travelled += next.value;
    ({ velocity } = next);
  }
  return travelled;
};

describe(decay, () => {
  it("travels velocity times tau in total", () => {
    expect(decay(1000, 95, 1e6).value).toBeCloseTo(decayDistance(1000, 95), 9);
    expect(decayDistance(1000, 95)).toBeCloseTo(95, 9);
  });

  it("travels the same distance at 60 and 120 Hz", () => {
    expect(travelAt(60)).toBeCloseTo(travelAt(120), 6);
  });
});

describe(velocityTracker, () => {
  it("fits a steady motion exactly", () => {
    const tracker = velocityTracker();
    for (let t = 0; t <= 120; t += 8) {
      tracker.push(t, t * 0.5);
    }
    expect(tracker.velocity(120)).toBeCloseTo(500, 6);
  });

  it("ignores samples older than 100 ms", () => {
    const tracker = velocityTracker();
    for (let t = 0; t <= 300; t += 8) {
      tracker.push(t, t < 150 ? 0 : (t - 150) * 2);
    }
    expect(tracker.velocity(296)).toBeCloseTo(2000, 6);
  });

  it("gives zero after a 40 ms pause", () => {
    const tracker = velocityTracker();
    for (let t = 0; t <= 80; t += 8) {
      tracker.push(t, t);
    }
    expect(tracker.velocity(120)).toBeCloseTo(1000, 6);
    expect(tracker.velocity(121)).toBe(0);
  });
});
