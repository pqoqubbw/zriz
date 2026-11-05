import { double, assert as fcAssert, property } from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../src";
import { decay, frameClock, spring, velocityTracker } from "../src/motion";

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
  ])("%s damping matches numeric integration", (_, zeta) => {
    const exact = spring(100, -300, 16.1, zeta, 120).value;

    expect(exact).toBeCloseTo(integrate(100, -300, 16.1, zeta, 120), 1);
  });

  it("starts at the given displacement and velocity", () => {
    for (const zeta of [1, 1.4]) {
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
    expect(decay(1000, 95, 1e6).value).toBeCloseTo(95, 9);
  });

  it("travels the same distance at 60 and 120 Hz", () => {
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

  it("forgets the motion before a pause, even if a still sample follows", () => {
    const tracker = velocityTracker();

    for (let t = 0; t <= 40; t += 8) {
      tracker.push(t, t * 2);
    }

    tracker.push(130, 80);
    expect(tracker.velocity(131)).toBe(0);
  });

  it("gives zero for samples less than 10 ms apart", () => {
    const twitch = fed([
      [0, 0],
      [1, 2],
    ]);

    expect(twitch.velocity(1)).toBe(0);
    const longer = fed([
      [0, 0],
      [1, 2],
      [2, 2],
      [9, 2],
    ]);

    expect(longer.velocity(9)).toBe(0);
  });

  it("forgets the motion before a pause when a twitch follows", () => {
    const tracker = fed([
      [0, 0],
      [8, 16],
      [16, 32],
      [130, 33],
      [131, 35],
    ]);

    expect(tracker.velocity(132)).toBe(0);
  });

  it("keeps two samples one 60 hz frame apart", () => {
    const tracker = fed([
      [0, 0],
      [1000 / 60, 10],
    ]);

    expect(tracker.velocity(1000 / 60)).toBeCloseTo(600, 6);
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

  it("steps on a timer when no frame comes", () => {
    frames();
    const step = vi.fn<(time: number) => void>();

    frameClock().request(step);
    vi.advanceTimersByTime(249);
    expect(step).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
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

  it("drops the frame when the timer wins", () => {
    const queue = frames();

    frameClock().request(vi.fn<(time: number) => void>());
    vi.advanceTimersByTime(250);
    expect(queue.size).toBe(0);
  });

  it("cancels the frame and the timer", () => {
    const queue = frames();
    const step = vi.fn<(time: number) => void>();
    const clock = frameClock();
    const handle = clock.request(step);

    clock.cancel(handle);
    vi.advanceTimersByTime(1000);
    expect(step).not.toHaveBeenCalled();
    expect(queue.size).toBe(0);
  });

  it("uses a short timer where there are no frames at all", () => {
    const step = vi.fn<(time: number) => void>();

    frameClock().request(step);
    vi.advanceTimersByTime(17);
    expect(step).toHaveBeenCalledOnce();
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

  it("cancels one frame and leaves the others", () => {
    const clock = frameClock();
    const dropped = vi.fn<(time: number) => void>();
    const kept = vi.fn<(time: number) => void>();
    const handle = clock.request(dropped);

    clock.request(kept);
    clock.cancel(handle);
    vi.advanceTimersByTime(17);
    expect(dropped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
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
