import { double, assert as fcAssert, property } from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../src";
import { decay, frameClock, spring, velocityTracker } from "../src/motion";
import { noop } from "./cropper-fixture";

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
    ["over", 1.4],
  ])(
    "%s damping starts where it is told and matches numeric integration",
    (_, zeta) => {
      const start = spring(42, 7, 20, zeta, 0);
      const exact = spring(100, -300, 16.1, zeta, 120).value;

      expect(start.value).toBeCloseTo(42, 10);
      expect(start.velocity).toBeCloseTo(7, 8);
      expect(exact).toBeCloseTo(integrate(100, -300, 16.1, zeta, 120), 1);
    }
  );

  it("is the same through hitches as in one step", () => {
    fcAssert(
      property(
        double({ max: 500, min: -500, noNaN: true }),
        double({ max: 5000, min: -5000, noNaN: true }),
        double({ max: 200, min: 1, noNaN: true }),
        double({ max: 200, min: 1, noNaN: true }),
        (x0, v0, a, b) => {
          for (const zeta of [1, 1.4]) {
            const mid = spring(x0, v0, 16.1, zeta, a);
            const split = spring(mid.value, mid.velocity, 16.1, zeta, b);
            const direct = spring(x0, v0, 16.1, zeta, a + b);

            expect(split.value).toBeCloseTo(direct.value, 6);
          }
        }
      )
    );
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
  it("travels velocity times tau in total, the same at 60 and 120 Hz", () => {
    expect(decay(1000, 95, 1e6).value).toBeCloseTo(95, 9);
    expect(travelAt(60)).toBeCloseTo(travelAt(120), 6);
  });
});

const fed = (samples: readonly (readonly [number, number])[]) => {
  const tracker = velocityTracker();

  for (const [time, value] of samples) {
    tracker.push(time, value);
  }

  return tracker;
};

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

  it.each([
    [
      "a still sample",
      [
        [0, 0],
        [8, 16],
        [16, 32],
        [24, 48],
        [32, 64],
        [40, 80],
        [130, 80],
      ],
      131,
    ],
    [
      "a twitch",
      [
        [0, 0],
        [8, 16],
        [16, 32],
        [130, 33],
        [131, 35],
      ],
      132,
    ],
    [
      "nothing",
      [
        [0, 0],
        [40, 40],
        [80, 80],
      ],
      121,
    ],
  ] as const)(
    "forgets the motion before a pause followed by %s",
    (_, samples, at) => {
      expect(fed(samples).velocity(at)).toBe(0);
    }
  );

  it.each([
    [
      [
        [0, 0],
        [1, 2],
      ],
      1,
      0,
    ],
    [
      [
        [0, 0],
        [1, 2],
        [2, 2],
        [9, 2],
      ],
      9,
      0,
    ],
    [
      [
        [0, 0],
        [1000 / 60, 10],
      ],
      1000 / 60,
      600,
    ],
    [
      [
        [0, 0],
        [40, 40],
        [80, 80],
      ],
      120,
      1000,
    ],
  ] as const)(
    "reads %j at %d ms as %d, nothing from under 10 ms of samples",
    (samples, at, velocity) => {
      expect(fed(samples).velocity(at)).toBeCloseTo(velocity, 6);
    }
  );
});

const frames = () => {
  const queue = new Map<number, FrameRequestCallback>();
  let id = 0;

  vi.stubGlobal("requestAnimationFrame", (step: FrameRequestCallback) => {
    id += 1;
    queue.set(id, step);

    return id;
  });

  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    queue.delete(handle);
  });

  return queue;
};

describe(frameClock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("steps on a timer when no frame comes, and only once", () => {
    const queue = frames();
    const step = vi.fn<(time: number) => void>();

    frameClock().request(step);
    vi.advanceTimersByTime(249);
    expect(step).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(step).toHaveBeenCalledOnce();

    for (const run of queue.values()) {
      run(300);
    }

    expect(step).toHaveBeenCalledOnce();
  });

  it("steps once when a frame comes, with the frame's time", () => {
    const queue = frames();
    const step = vi.fn<(time: number) => void>();

    frameClock().request(step);

    for (const run of queue.values()) {
      run(16);
    }

    vi.advanceTimersByTime(1000);
    expect(step).toHaveBeenCalledExactlyOnceWith(16);
  });

  it.each([
    [
      "frames",
      () => {
        frames();
      },
    ],
    ["no frames", noop],
  ])("cancels one request and leaves the others with %s", (_, install) => {
    install();
    const clock = frameClock();
    const dropped = vi.fn<(time: number) => void>();
    const kept = vi.fn<(time: number) => void>();
    const handle = clock.request(dropped);

    clock.request(kept);
    clock.cancel(handle);
    vi.advanceTimersByTime(1000);
    expect(dropped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });

  it("still reports writes, finishes held motion and commits once on a page where frames stop", () => {
    frames();
    const commits: number[] = [];
    let changes = 0;
    const cropper = createCropper({
      image: { height: 300, width: 400 },
      onValueChange: () => {
        changes += 1;
      },
      onValueCommit: (value) => {
        commits.push(value.rotation);
      },
    });
    let ticks = 0;

    cropper.setRotation(5);

    cropper.run(() => {
      ticks += 1;

      return ticks < 2;
    });

    vi.advanceTimersByTime(2000);
    expect(commits).toStrictEqual([5]);
    expect(changes).toBe(1);
    expect(ticks).toBe(2);
    expect(cropper.getState().committed.rotation).toBe(5);
    expect(cropper.getState().settling).toBeFalsy();
    cropper.destroy();
  });
});

describe("the timer clock used in node", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a frame about 16 ms later in node, stamped with its own now", () => {
    const clock = frameClock();
    const start = performance.now();
    const step = vi.fn<(time: number) => void>();

    clock.request(step);
    vi.advanceTimersByTime(15);
    expect(step).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(step).toHaveBeenCalledExactlyOnceWith(start + 16);
  });

  it("drives a cropper with no clock option and goes idle", () => {
    const commits: number[] = [];
    const cropper = createCropper({
      image: { height: 3024, width: 4032 },
      onValueCommit: (value) => {
        commits.push(value.rotation);
      },
    });

    cropper.setRotation(7);
    expect(commits).toStrictEqual([]);
    vi.advanceTimersByTime(17);
    expect(commits).toStrictEqual([7]);
    expect(vi.getTimerCount()).toBe(0);
    cropper.setRotation(3);
    expect(vi.getTimerCount()).toBe(1);
    cropper.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
