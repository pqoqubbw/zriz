import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import {
  constantFrom,
  double,
  assert as fcAssert,
  integer,
  oneof,
  property,
  record,
  tuple,
} from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCropper,
  defaultValue,
  parse,
  serialize,
  valuesEqual,
} from "../src";
import type {
  CropValue,
  CropState,
  CropperEvents,
  CropperOptions,
} from "../src";
import { isCropCovered } from "../src/geometry";
import { fakeClock } from "./fake-clock";

const photo = { height: 3000, width: 4000 };

const cropState = (state: CropState | null): CropState => {
  if (!state) {
    throw new Error("no image");
  }
  return state;
};

const setup = (options: CropperOptions = {}) => {
  const time = fakeClock();
  const change = vi.fn<CropperEvents["change"]>();
  const commit = vi.fn<CropperEvents["commit"]>();
  const cropper = createCropper({
    clock: time.clock,
    image: photo,
    onValueChange: (value, details) => {
      change(value, details);
    },
    onValueCommit: (value, details) => {
      commit(value, details);
    },
    ...options,
  });
  return { change, commit, cropper, time };
};

describe("events", () => {
  it("emits nothing without input, the initial value included", () => {
    const { change, commit, time } = setup({
      defaultValue: { center: { x: 0.9, y: 0.9 }, rotation: 12 },
    });
    time.frames(10);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("emits nothing for a value equal to the current one", () => {
    const { change, commit, cropper, time } = setup();
    cropper.setValue({ ...cropper.getValue() });
    cropper.setValue({ rotation: 0 });
    time.frames(3);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("coalesces changes to one per frame", () => {
    const { change, cropper, time } = setup();
    cropper.setZoom(3);
    for (let i = 0; i < 10; i += 1) {
      cropper.panBy(0.01, 0);
    }
    expect(change).not.toHaveBeenCalled();
    time.frame();
    expect(change).toHaveBeenCalledOnce();
    expect(change.mock.calls[0]?.[1].changed).toStrictEqual(["center", "size"]);
  });

  it("commits once per gesture and marks its phases", () => {
    const { change, commit, cropper, time } = setup();
    cropper.setZoom(4, { emit: false });
    cropper.begin("pan");
    for (let i = 0; i < 5; i += 1) {
      cropper.panBy(0.01, 0.01);
      time.frame();
    }
    expect(commit).not.toHaveBeenCalled();
    cropper.panBy(0.01, 0);
    cropper.end();
    time.frame();
    expect(change.mock.calls.map(([, d]) => d.phase)).toStrictEqual([
      "start",
      "move",
      "move",
      "move",
      "move",
      "end",
    ]);
    expect(change.mock.calls.every(([, d]) => d.reason === "pan")).toBeTruthy();
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[1].reason).toBe("pan");
  });

  it("treats a restarted gesture as one", () => {
    const { commit, cropper, time } = setup();
    const starts = vi.fn<() => void>();
    cropper.on("gesturestart", starts);
    cropper.begin("pan");
    cropper.setRotation(3);
    time.frame();
    cropper.begin("pinch");
    cropper.setRotation(6);
    time.frame();
    cropper.end();
    time.frame();
    expect(starts).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
  });

  it("does not commit a gesture that changed nothing", () => {
    const { commit, cropper, time } = setup();
    cropper.begin("pan");
    cropper.panBy(0.2, 0);
    time.frame();
    cropper.end();
    time.frames(3);
    expect(commit).not.toHaveBeenCalled();
  });

  it("waits for running motion before committing", () => {
    const { commit, cropper, time } = setup();
    cropper.begin("dial");
    cropper.setRotation(5);
    cropper.end();
    let left = 10;
    cropper.run(() => {
      cropper.setRotation(5 + (10 - left));
      left -= 1;
      return left > 0;
    });
    time.frames(5);
    expect(commit).not.toHaveBeenCalled();
    time.frames(10);
    expect(commit).toHaveBeenCalledOnce();
    expect(cropper.getValue().rotation).toBe(14);
  });

  it("asks for one frame at a time", () => {
    const { cropper, time } = setup();
    cropper.run(() => {
      cropper.setRotation(cropper.getValue().rotation + 1);
      return true;
    });
    for (let i = 0; i < 5; i += 1) {
      expect(time.pending()).toBe(1);
      time.frame();
    }
  });

  it("commits an instant action once", () => {
    const { commit, cropper, time } = setup();
    cropper.rotate90();
    time.frames(3);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[1].reason).toBe("rotate-90");
  });

  it("lets a listener cancel a frame", () => {
    const { commit, cropper, time } = setup();
    const before = cropper.getValue();
    cropper.on("change", (_, details) => {
      details.cancel();
    });
    cropper.setRotation(10);
    time.frames(2);
    expect(cropper.getValue()).toBe(before);
    expect(commit).not.toHaveBeenCalled();
  });

  it("never echoes a controlled value", () => {
    const { change, commit, cropper, time } = setup();
    const next = { ...cropper.getValue(), rotation: 8 };
    cropper.setValue(next, { emit: false, reason: "controlled" });
    cropper.setValue(next, { emit: false, reason: "controlled" });
    time.frames(3);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(cropper.getState().committed.rotation).toBe(8);
  });

  it("reads pristine when the start value is refitted to the photo", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { aspect: 1, rotation: 60 },
      image: { height: 3024, width: 4032 },
    });
    time.frames(2);
    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setRotation(10);
    time.frames(2);
    expect(cropper.getState().pristine).toBeFalsy();
    cropper.reset();
    time.frames(2);
    expect(cropper.getState().pristine).toBeTruthy();
    cropper.destroy();
  });

  it("takes a value and a reset before any image, with their own change reasons", () => {
    const time = fakeClock();
    const cropper = createCropper({ clock: time.clock });
    const reasons: string[] = [];
    cropper.on("change", (_, details) => {
      reasons.push(details.reason);
    });
    cropper.setValue({ rotation: 12 });
    time.frames(2);
    expect(cropper.getValue().rotation).toBe(12);
    cropper.reset();
    time.frames(2);
    expect(cropper.getValue().rotation).toBe(0);
    expect(reasons).toStrictEqual(["imperative", "reset"]);
    cropper.destroy();
  });

  it("notifies state subscribers when any one snapshot field changes and never without a change", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3024, width: 4032 },
    });
    time.frames(2);
    const listener = vi.fn<() => void>();
    const off = cropper.subscribe(listener);
    cropper.setOptions({ disabled: false });
    time.frames(2);
    expect(listener).not.toHaveBeenCalled();
    const steps: [string, () => void][] = [
      [
        "disabled",
        () => {
          cropper.setOptions({ disabled: true });
        },
      ],
      [
        "disabled",
        () => {
          cropper.setOptions({ disabled: false });
        },
      ],
      [
        "interacting",
        () => {
          cropper.begin("pan");
        },
      ],
      [
        "settling",
        () => {
          cropper.run(() => false, false);
        },
      ],
      [
        "settling",
        () => {
          time.frame();
        },
      ],
      [
        "pristine",
        () => {
          cropper.setZoom(2);
        },
      ],
      [
        "mirrored",
        () => {
          cropper.flip("x");
        },
      ],
      [
        "quarterTurns",
        () => {
          cropper.rotate90();
        },
      ],
      [
        "aspect",
        () => {
          cropper.setAspect(1);
        },
      ],
      [
        "interacting",
        () => {
          cropper.end();
        },
      ],
      [
        "committed",
        () => {
          time.frame();
        },
      ],
      [
        "ready",
        () => {
          cropper.setImage(null);
        },
      ],
    ];
    for (const [field, step] of steps) {
      const before = Object.entries(cropper.getState());
      listener.mockClear();
      step();
      const changed = Object.entries(cropper.getState()).flatMap(
        ([key, part], index) => (part === before[index]?.[1] ? [] : [key])
      );
      expect(changed).toStrictEqual([field]);
      expect(listener.mock.calls.length).toBeGreaterThan(0);
    }
    off();
    cropper.destroy();
  });

  it("keeps a locked square crop square in source pixels", () => {
    fcAssert(
      property(
        double({ max: 0.99, min: 0.05, noNaN: true }),
        double({ max: 0.95, min: 0.05, noNaN: true }),
        double({ max: 0.95, min: 0.05, noNaN: true }),
        constantFrom(0, 1, 2, 3),
        (size, x, y, quarterTurns) => {
          const cropper = createCropper({
            defaultValue: { aspect: 1, quarterTurns },
            image: { height: 3024, width: 4031 },
          });
          cropper.setValue({
            center: { x, y },
            size: { height: size, width: size * (3024 / 4031) },
          });
          const plan = cropper.getPixelCrop();
          const small = plan ? cropper.getPixelCrop(512 / plan.width) : null;
          cropper.destroy();
          expect(plan?.width).toBe(plan?.height);
          expect(small?.width).toBe(small?.height);
        }
      )
    );
  });

  it("destroys the plugins it started, even after setOptions", () => {
    const first = {
      destroy: vi.fn<() => void>(),
      init: vi.fn<() => void>(),
      name: "first",
    };
    const second = {
      destroy: vi.fn<() => void>(),
      init: vi.fn<() => void>(),
      name: "second",
    };
    const cropper = createCropper({ plugins: [first] });
    cropper.setOptions({ plugins: [second] });
    cropper.destroy();
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(second.init).not.toHaveBeenCalled();
    expect(second.destroy).not.toHaveBeenCalled();
  });

  it("stops the clock when idle and after destroy", () => {
    const { cropper, time } = setup();
    cropper.panBy(0.1, 0);
    time.frames(2);
    expect(time.pending()).toBe(0);
    cropper.setRotation(3);
    cropper.destroy();
    expect(time.pending()).toBe(0);
  });
});

describe("snapshot", () => {
  it("changes only on discrete transitions", () => {
    const { cropper, time } = setup();
    const seen: unknown[] = [];
    cropper.subscribe(() => {
      seen.push(cropper.getState());
    });
    cropper.setZoom(4, { emit: false });
    seen.length = 0;
    cropper.begin("pan");
    for (let i = 0; i < 20; i += 1) {
      cropper.panBy(0.001, 0);
      time.frame();
    }
    cropper.end();
    time.frame();
    expect(seen.length).toBeLessThanOrEqual(3);
    expect(cropper.getState().interacting).toBeNull();
  });

  it("tracks pristine", () => {
    const { cropper, time } = setup();
    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setRotation(4);
    time.frame();
    expect(cropper.getState().pristine).toBeFalsy();
    cropper.reset();
    time.frame();
    expect(cropper.getState().pristine).toBeTruthy();
  });
});

describe("actions", () => {
  it("zooms back to the start size when the dial returns to 0", () => {
    const { cropper } = setup();
    cropper.setZoom(1.1);
    const start = cropper.getValue().size;
    cropper.begin("dial");
    cropper.setRotation(30);
    expect(cropper.getValue().size.width).toBeLessThan(start.width);
    cropper.setRotation(0);
    cropper.end();
    expect(cropper.getValue().size.width).toBeCloseTo(start.width, 9);
  });

  it("restores the value after four quarter turns and two flips", () => {
    const { cropper } = setup();
    cropper.setValue({
      center: { x: 0.4, y: 0.6 },
      rotation: 7,
      size: { height: 0.4, width: 0.3 },
    });
    const before = cropper.getValue();
    for (let i = 0; i < 4; i += 1) {
      cropper.rotate90();
    }
    cropper.flip("x");
    cropper.flip("x");
    expect(valuesEqual(cropper.getValue(), before)).toBeTruthy();
  });

  it("keeps the value when the same image is set again", () => {
    const { change, cropper, time } = setup();
    cropper.setValue({ rotation: 5 });
    time.frame();
    change.mockClear();
    const before = cropper.getValue();
    cropper.setImage({ ...photo });
    time.frames(2);
    expect(cropper.getValue()).toBe(before);
    expect(change).not.toHaveBeenCalled();
  });

  it("applies a value set before the image loads", () => {
    const time = fakeClock();
    const cropper = createCropper({ clock: time.clock });
    cropper.setValue({ rotation: 10 });
    cropper.setImage(photo);
    expect(cropper.getValue().rotation).toBe(10);
    expect(isCropCovered(cropState(cropper.getCropState()))).toBeTruthy();
  });

  it("holds a fixed aspect through every action", () => {
    const { cropper } = setup({ defaultValue: { aspect: 4 / 5 } });
    cropper.setRotation(-20);
    cropper.setZoom(3);
    cropper.panBy(0.3, -0.2);
    const { width, height } = cropState(cropper.getCropState()).crop;
    expect(width / height).toBeCloseTo(4 / 5, 9);
  });
});

const action = oneof(
  record({
    kind: constantFrom("rotate" as const),
    n: double({ max: 60, min: -60, noNaN: true }),
  }),
  record({
    kind: constantFrom("zoom" as const),
    n: double({ max: 20, min: 0.5, noNaN: true }),
  }),
  record({
    kind: constantFrom("pan" as const),
    n: tuple(
      double({ max: 1, min: -1, noNaN: true }),
      double({ max: 1, min: -1, noNaN: true })
    ),
  }),
  record({
    kind: constantFrom("aspect" as const),
    n: constantFrom("free" as const, "original" as const, 1, 16 / 9, 0.2),
  }),
  record({
    kind: constantFrom("turn" as const, "flip" as const, "reset" as const),
    n: integer({ max: 1, min: 0 }),
  })
);

describe("invariants", () => {
  it("moves the crop instead of zooming past the maximum when turning", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 61, width: 13 },
    });
    cropper.setRotation(45);
    cropper.setZoom(0.5);
    cropper.setZoom(3.1967245081967204);
    cropper.panBy(0, -0.6599663713976182);
    cropper.setRotation(0);
    expect(cropper.getZoom()).toBeLessThanOrEqual(15 * (1 + 1e-9));
  });

  it("keeps every value valid under any sequence of actions", () => {
    fcAssert(
      property(
        record({
          height: integer({ max: 9000, min: 1 }),
          width: integer({ max: 9000, min: 1 }),
        }),
        action.chain((first) =>
          tuple(constantFrom(first), action, action, action, action)
        ),
        (image, actions) => {
          const time = fakeClock();
          const cropper = createCropper({
            clock: time.clock,
            image,
            minSize: { height: 1, width: 1 },
          });
          for (const step of actions) {
            switch (step.kind) {
              case "rotate": {
                cropper.setRotation(step.n);
                break;
              }
              case "zoom": {
                cropper.setZoom(step.n);
                break;
              }
              case "pan": {
                cropper.panBy(step.n[0], step.n[1]);
                break;
              }
              case "aspect": {
                cropper.setAspect(step.n);
                break;
              }
              case "turn": {
                cropper.rotate90(step.n ? "cw" : "ccw");
                break;
              }
              case "flip": {
                cropper.flip(step.n ? "y" : "x");
                break;
              }
              case "reset": {
                cropper.reset();
                break;
              }
              default: {
                break;
              }
            }
            const state = cropState(cropper.getCropState());
            expect(isCropCovered(state, 1e-6)).toBeTruthy();
            expect(Math.abs(state.angle)).toBeLessThanOrEqual(45);
            expect(cropper.getZoom()).toBeLessThanOrEqual(15 * (1 + 1e-6));
            expect(cropper.getZoom()).toBeGreaterThanOrEqual(1 - 1e-5);
            const value: CropValue = cropper.getValue();
            expect(parse(serialize(value))).toStrictEqual(value);
          }
        }
      )
    );
  });
});

const isCollector = (value: unknown): value is () => void =>
  typeof value === "function";

describe("what the cropper holds on to", () => {
  it("keeps only the size of the image it was given", () => {
    const given = { height: 30, preview: {}, width: 40 };
    const cropper = createCropper({ clock: fakeClock().clock, image: given });
    expect(cropper.getCropState()?.image).toStrictEqual({
      height: 30,
      width: 40,
    });
    cropper.setImage(given);
    expect(cropper.getCropState()?.image).toStrictEqual({
      height: 30,
      width: 40,
    });
  });

  it("drops the last event after its frame", async () => {
    setFlagsFromString("--expose-gc");
    const collect: unknown = runInNewContext("gc");
    if (!isCollector(collect)) {
      throw new TypeError("no gc");
    }
    const { clock, frames } = fakeClock();
    const cropper = createCropper({
      clock,
      image: { height: 3000, width: 4000 },
    });
    frames(2);
    const ref = (() => {
      const event = new Event("pointermove");
      cropper.setZoom(2, { event });
      return new WeakRef(event);
    })();
    frames(3);
    await vi.waitFor(() => {
      collect();
      expect(ref.deref() === undefined).toBeTruthy();
    });
    expect(cropper.getZoom()).toBeGreaterThan(1);
  });
});

const isTurns = (value: number): value is CropValue["quarterTurns"] =>
  Number.isFinite(value);

const sweepAndBack = (options: CropperOptions) => {
  const { cropper } = setup({
    image: { height: 1000, width: 1000 },
    ...options,
  });
  cropper.setValue({
    center: { x: 0.75, y: 0.75 },
    size: { height: 0.4, width: 0.4 },
  });
  const start = cropper.getValue();
  cropper.begin("dial");
  for (const angle of [10, 20, 30, 20, 10, 0]) {
    cropper.setRotation(angle, { reason: "dial" });
  }
  return { back: cropper.getValue(), start };
};

describe("value edges", () => {
  it("treats an angle that reads as level as level", () => {
    const { cropper } = setup();
    cropper.setRotation(10);
    cropper.setRotation(1e-13);
    expect(cropper.getValue().rotation).toBe(0);
    expect(cropper.getPixelCrop()?.pixelRect).not.toBeNull();
  });

  it("gives a level plan after angles that sum to almost zero", () => {
    const { cropper } = setup();
    let angle = 0;
    for (const step of [0.1, 0.1, 0.1, -0.1, -0.1, -0.1]) {
      angle += step;
      cropper.setRotation(angle);
    }
    expect(cropper.getCropState()?.angle).toBe(0);
    expect(cropper.getPixelCrop()?.pixelRect).not.toBeNull();
  });

  it("treats a perspective that reads as flat as flat", () => {
    const { cropper } = setup();
    cropper.setValue({ perspective: { horizontal: 0, vertical: 10 } });
    cropper.setValue({ perspective: { horizontal: 1e-13, vertical: 1e-13 } });
    expect(cropper.getPixelCrop()?.homography).toBeNull();
    expect(cropper.getPixelCrop()?.pixelRect).not.toBeNull();
  });

  it("rounds a fractional image size to whole pixels", () => {
    const { cropper } = setup({ image: { height: 10, width: 10.5 } });
    expect(cropper.getPixelCrop()?.pixelRect).toStrictEqual({
      height: 10,
      left: 0,
      top: 0,
      width: 11,
    });
  });

  it("keeps an image under half a pixel at one pixel", () => {
    const { cropper } = setup({ image: { height: 0.4, width: 0.4 } });
    expect(cropper.getCropState()?.image).toStrictEqual({
      height: 1,
      width: 1,
    });
  });

  it.each([
    [1.5, 2],
    [5, 1],
    [-1, 3],
  ])("reads quarter turns %d as %d", (given, turns) => {
    if (!isTurns(given)) {
      throw new Error("not a number");
    }
    const quarterTurns = given;
    const set = setup();
    set.cropper.setValue({ quarterTurns });
    expect(set.cropper.getValue().quarterTurns).toBe(turns);
    const held = setup({ defaultValue: { quarterTurns } });
    expect(held.cropper.getValue().quarterTurns).toBe(turns);
    const controlled = setup({
      value: { ...held.cropper.getValue(), quarterTurns },
    });
    expect(controlled.cropper.getValue().quarterTurns).toBe(turns);
    const late = setup({
      image: undefined,
      value: { ...held.cropper.getValue(), quarterTurns },
    });
    late.cropper.setImage(photo);
    expect(late.cropper.getValue().quarterTurns).toBe(turns);
  });

  it.each([
    ["with no minimum", {}],
    [
      "with a minimum that holds the crop",
      { minSize: { height: 400, width: 400 } },
    ],
  ])("returns a dial sweep to the same crop %s", (_, options) => {
    const { back, start } = sweepAndBack(options);
    expect(back.size.width).toBeCloseTo(start.size.width, 9);
    expect(back.center.x).toBeCloseTo(start.center.x, 9);
    expect(back.center.y).toBeCloseTo(start.center.y, 9);
  });

  it("keeps a pan when a pan gesture also sets the rotation", () => {
    const { cropper } = setup();
    cropper.setValue({ size: { height: 0.5, width: 0.5 } });
    cropper.begin("pan");
    cropper.panBy(0.1, 0);
    const moved = cropper.getValue().center.x;
    cropper.setRotation(0.001);
    expect(cropper.getValue().center.x).toBeCloseTo(moved, 3);
  });
});

describe("listener isolation", () => {
  const boom = (): never => {
    throw new Error("app bug");
  };

  const reported = () => {
    const errors: unknown[] = [];
    vi.stubGlobal("queueMicrotask", (step: () => void) => {
      try {
        step();
      } catch (error) {
        errors.push(error);
      }
    });
    return errors;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps frames and commits going past a throwing change listener", () => {
    const errors = reported();
    const { commit, cropper, time } = setup();
    const later = vi.fn();
    const frame = vi.fn();
    cropper.on("change", boom);
    cropper.on("change", later);
    cropper.on("frame", frame);
    cropper.setRotation(5);
    time.frame();
    expect(later).toHaveBeenCalledOnce();
    expect(frame).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });

  it("clears settling and fires settle past a throwing commit listener", () => {
    const errors = reported();
    const { cropper, time } = setup();
    const settle = vi.fn();
    cropper.on("commit", boom);
    cropper.on("settle", settle);
    cropper.setRotation(5);
    cropper.run(() => false);
    time.frame();
    expect(settle).toHaveBeenCalledOnce();
    expect(cropper.getState().settling).toBe(false);
    expect(errors).toHaveLength(1);
  });

  it("drops a throwing task and keeps the frame loop", () => {
    const errors = reported();
    const { commit, cropper, time } = setup();
    const task = vi.fn(boom);
    cropper.run(task);
    time.frame();
    cropper.setRotation(5);
    time.frame();
    expect(task).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });

  it("finishes ending a gesture past a throwing gestureend listener", () => {
    const errors = reported();
    const { commit, cropper, time } = setup();
    cropper.on("gestureend", boom);
    cropper.begin("pan");
    cropper.setRotation(5);
    cropper.end();
    time.frames(2);
    expect(cropper.getState().interacting).toBeNull();
    expect(commit).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });

  it("returns from a listener that removes and adds itself during an emit", () => {
    const { cropper } = setup();
    const spy = vi.fn();
    const rearm = (): void => {
      spy();
      off();
      off = cropper.on("stop", rearm);
    };
    let off = cropper.on("stop", rearm);
    cropper.stop();
    cropper.stop();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns from a subscriber that resubscribes during a refresh", () => {
    const { cropper } = setup();
    const spy = vi.fn();
    const rearm = (): void => {
      spy();
      off();
      off = cropper.subscribe(rearm);
    };
    let off = cropper.subscribe(rearm);
    cropper.flip();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("skips a listener another listener removed, and holds a new one for next time", () => {
    const { cropper } = setup();
    const removed = vi.fn();
    const added = vi.fn();
    cropper.on("stop", () => {
      off();
      cropper.on("stop", added);
    });
    const off = cropper.on("stop", removed);
    cropper.stop();
    expect(removed).not.toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
  });
});

describe("destroy", () => {
  it("fires once when a listener or plugin destroys again", () => {
    const spy = vi.fn();
    const { cropper } = setup({
      plugins: [
        {
          destroy() {
            spy();
            cropper.destroy();
          },
          init: () => undefined,
          name: "again",
        },
      ],
    });
    const fired = vi.fn(() => {
      cropper.destroy();
    });
    cropper.on("destroy", fired);
    cropper.destroy();
    expect(spy).toHaveBeenCalledOnce();
    expect(fired).toHaveBeenCalledOnce();
  });

  it("finishes past a throwing plugin, and keeps a plugin's this", () => {
    const errors: unknown[] = [];
    vi.stubGlobal("queueMicrotask", (step: () => void) => {
      try {
        step();
      } catch (error) {
        errors.push(error);
      }
    });
    const next = {
      destroy(this: { seen?: boolean }) {
        this.seen = true;
      },
      init: () => undefined,
      name: "next",
      seen: false,
    };
    const { change, cropper, time } = setup({
      plugins: [
        {
          destroy() {
            throw new Error("plugin failed");
          },
          init: () => undefined,
          name: "bad",
        },
        next,
      ],
    });
    const fired = vi.fn();
    cropper.on("destroy", fired);
    cropper.destroy();
    vi.unstubAllGlobals();
    cropper.setRotation(10);
    time.frames(2);
    expect(next.seen).toBe(true);
    expect(fired).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
    expect(change).not.toHaveBeenCalled();
  });

  it("leaves nothing to change afterwards", () => {
    const { commit, cropper, time } = setup();
    cropper.begin("pan");
    cropper.setRotation(5);
    const before = cropper.getState();
    cropper.destroy();
    expect(cropper.getState().interacting).toBeNull();
    expect(before.interacting).toBe("pan");
    const task = vi.fn(() => true);
    cropper.run(task)();
    cropper.setOptions({ disabled: true, maxZoom: 2 });
    cropper.stop();
    cropper.on("commit", vi.fn())();
    cropper.subscribe(vi.fn())();
    time.frames(3);
    expect(task).not.toHaveBeenCalled();
    expect(cropper.getState().settling).toBe(false);
    expect(cropper.getState().disabled).toBe(false);
    expect(cropper.getMaxZoom()).toBe(15);
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("event order", () => {
  it("shows a commit listener the new committed value", () => {
    const { cropper, time } = setup();
    const seen: number[] = [];
    cropper.on("commit", () => {
      seen.push(cropper.getState().committed.rotation);
    });
    cropper.setRotation(5);
    time.frame();
    cropper.setRotation(9);
    time.frame();
    expect(seen).toStrictEqual([5, 9]);
  });

  it("shows gesture and stop listeners a fresh snapshot", () => {
    const { cropper, time } = setup();
    const seen: unknown[] = [];
    cropper.on("gesturestart", () => {
      seen.push(cropper.getState().interacting);
    });
    cropper.on("gestureend", () => {
      seen.push(cropper.getState().interacting);
    });
    cropper.on("stop", () => {
      seen.push(cropper.getState().settling);
    });
    cropper.begin("pan");
    cropper.end();
    time.frame();
    cropper.run(() => true);
    cropper.stop();
    expect(seen).toStrictEqual(["pan", null, false]);
  });
});

describe("change and commit reporting", () => {
  it("reports a write made inside a change listener", () => {
    const { change, commit, cropper, time } = setup();
    cropper.on("change", (value) => {
      if (value.rotation > 10) {
        cropper.setValue({ rotation: 10 });
      }
    });
    cropper.setValue({ rotation: 20 });
    time.frames(3);
    expect(change.mock.calls.map(([value]) => value.rotation)).toStrictEqual([
      20, 10,
    ]);
    expect(change.mock.calls[1]?.[1].previous.rotation).toBe(20);
    expect(commit.mock.calls.map(([value]) => value.rotation)).toStrictEqual([
      10,
    ]);
  });

  it("reports a later photo's refit as a change with the old value as previous", () => {
    const { change, commit, cropper, time } = setup({
      image: { height: 750, width: 1000 },
      value: {
        ...defaultValue,
        aspect: 1,
        size: { height: 1, width: 0.75 },
      },
    });
    cropper.setImage({ height: 2000, width: 1000 });
    time.frames(2);
    expect(cropper.getValue().size).toStrictEqual({ height: 0.5, width: 1 });
    expect(change).toHaveBeenCalledOnce();
    expect(change.mock.calls[0]?.[1].reason).toBe("coverage");
    expect(change.mock.calls[0]?.[1].previous.size).toStrictEqual({
      height: 1,
      width: 0.75,
    });
    expect(commit.mock.calls[0]?.[1].reason).toBe("coverage");
  });

  it("stays quiet on a later photo that needs no refit", () => {
    const { change, commit, cropper, time } = setup();
    cropper.setImage({ height: 1500, width: 2000 });
    time.frames(2);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("lands a canceled refit on the new photo's fit and commits it", () => {
    const { commit, cropper, time } = setup({
      image: { height: 750, width: 1000 },
      value: {
        ...defaultValue,
        aspect: 1,
        size: { height: 1, width: 0.75 },
      },
    });
    cropper.on("change", (_, details) => {
      details.cancel();
    });
    cropper.setImage({ height: 2000, width: 1000 });
    time.frames(2);
    expect(cropper.getValue().size).toStrictEqual({ height: 0.5, width: 1 });
    expect(cropState(cropper.getCropState()).image.height).toBe(2000);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("keeps a canceled crop inside limits set after it was saved", () => {
    const { commit, cropper, time } = setup();
    cropper.setZoom(15);
    time.frames(2);
    commit.mockClear();
    cropper.on("change", (_, details) => {
      details.cancel();
    });
    cropper.setOptions({ maxZoom: 2 });
    time.frames(2);
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[0].size.width).toBeCloseTo(0.5, 6);
  });

  it("cancels a gesture into limits set during it", () => {
    const { cropper, time } = setup();
    cropper.setZoom(10);
    time.frames(2);
    cropper.begin("pan");
    cropper.setOptions({ minSize: { height: 1500, width: 2000 } });
    time.frame();
    cropper.cancel();
    time.frames(2);
    expect(cropper.getPixelCrop()?.width).toBe(2000);
    expect(cropper.getPixelCrop()?.height).toBe(1500);
  });

  it("restores the exact value when nothing about the limits changed", () => {
    const { cropper, time } = setup();
    cropper.setZoom(3);
    time.frames(2);
    const before = cropper.getValue();
    cropper.begin("pan");
    cropper.panBy(0.05, 0);
    time.frame();
    cropper.cancel();
    expect(cropper.getValue()).toBe(before);
  });

  it("drops a waiting change on a silent write of the same value", () => {
    const { change, commit, cropper, time } = setup();
    cropper.setRotation(5);
    cropper.setRotation(5, { emit: false });
    time.frames(3);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(cropper.getState().committed.rotation).toBe(5);
  });

  it("keeps the change and commit on a controlled echo of a waiting write", () => {
    const { change, commit, cropper, time } = setup();
    cropper.setRotation(5);
    cropper.setValue(cropper.getValue(), {
      emit: false,
      reason: "controlled",
    });
    time.frames(2);
    expect(change).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
  });

  it("keeps the commit on a silent echo inside the change listener", () => {
    const { commit, cropper, time } = setup();
    cropper.on("change", (value) => {
      cropper.setValue(value, { emit: false });
    });
    const before = cropper.getValue();
    cropper.setRotation(5);
    time.frames(2);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[1].previous).toBe(before);
  });

  it("takes a new lens on the next write of an equal value and redraws", () => {
    const tilted = { perspective: { horizontal: 0, vertical: 10 } };
    const { cropper, time } = setup({ defaultValue: tilted });
    const lens = (): number | undefined =>
      cropper.getCropState()?.perspective.focal;
    const before = lens();
    cropper.setOptions({ focalLength: 50 });
    expect(lens()).toBe(before);
    time.frames(2);
    const frame = vi.fn<CropperEvents["frame"]>();
    cropper.on("frame", frame);
    cropper.setValue({});
    time.frames(2);
    const wanted = (50 / 36) * 4000;
    expect(lens()).toBeCloseTo(wanted, 6);
    expect(frame.mock.calls.at(-1)?.[0].state?.perspective.focal).toBeCloseTo(
      wanted,
      6
    );
    cropper.setOptions({ focalLength: 26 });
    cropper.reset();
    expect(lens()).toBeCloseTo(before ?? 0, 6);
  });

  it("does not bring an old lens back through a canceled change", () => {
    const { cropper, time } = setup();
    cropper.setOptions({ focalLength: 50 });
    cropper.setValue({});
    time.frame();
    cropper.on("change", (_, details) => {
      details.cancel();
    });
    cropper.setRotation(5);
    time.frame();
    expect(cropper.getCropState()?.perspective.focal).toBeCloseTo(
      (50 / 36) * 4000,
      6
    );
  });
});
