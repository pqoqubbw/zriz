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
import { describe, expect, it, vi } from "vitest";

import { createCropper, parse, serialize, valuesEqual } from "../src";
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
