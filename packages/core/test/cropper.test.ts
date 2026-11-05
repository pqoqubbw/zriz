import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import {
  array,
  constant,
  constantFrom,
  double,
  assert as fcAssert,
  integer,
  oneof,
  pre,
  property,
  record,
  tuple,
} from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCropper,
  defaultValue,
  parse,
  sameAspect,
  serialize,
  valuesEqual,
} from "../src";
import type {
  Cropper,
  CropValue,
  CropState,
  CropperEvents,
  CropperOptions,
} from "../src";
import type { QuarterTurns } from "../src/geometry";
import { isCropCovered, isPerspectiveValid } from "../src/geometry";
import { fakeClock } from "./fake-clock";

const PHOTO = { height: 3000, width: 4000 };

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
    image: PHOTO,
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

const noop = (): void => {};

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

const sound = (value: CropValue): boolean =>
  [
    value.center.x,
    value.center.y,
    value.rotation,
    value.perspective.horizontal,
    value.perspective.vertical,
    value.size.width,
    value.size.height,
  ].every(Number.isFinite) &&
  value.size.width > 0 &&
  value.size.height > 0;

const withCrop = (cropper: Cropper, crop: Partial<CropState["crop"]>): void => {
  const state = cropState(cropper.getCropState());

  cropper.setCropState({ ...state, crop: { ...state.crop, ...crop } });
};

const onTheEdge = () => {
  const fixture = setup();

  fixture.cropper.setZoom(1.5);
  fixture.cropper.panBy(2, 0);
  fixture.time.frames(3);
  fixture.change.mockClear();
  fixture.commit.mockClear();

  return fixture;
};

const square = (min: number) => ({
  image: { height: 1000, width: 1000 },
  minSize: { height: min, width: min },
});

const pixels = (cropper: Cropper) => {
  const rect = cropper.getPixelCrop()?.pixelRect;

  return { height: rect?.height, width: rect?.width };
};

const deepFrozen = (target: object): boolean =>
  Object.isFrozen(target) &&
  (Object.values(target) as unknown[]).every(
    (item) => typeof item !== "object" || item === null || deepFrozen(item)
  );

const expectTilted = (cropper: Cropper): void => {
  expect(cropper.getValue().perspective).toStrictEqual({
    horizontal: 10,
    vertical: 10,
  });

  expect(cropState(cropper.getCropState()).perspective.focal).toBeGreaterThan(
    0
  );
};

const expectValid = (cropper: Cropper): void => {
  const value = cropper.getValue();
  const plan = cropper.getPixelCrop();

  expect(sound(value)).toBeTruthy();
  expect(cropper.getZoom()).toBeGreaterThanOrEqual(1 - 1e-9);
  expect(plan?.forward.every(Number.isFinite)).toBeTruthy();
  expect([plan?.width, plan?.height].every(Number.isFinite)).toBeTruthy();
  expect(isCropCovered(cropState(cropper.getCropState()))).toBeTruthy();
};

const nothing = (): void => undefined;

const loose = (cropper: Cropper, given: unknown): void => {
  Reflect.apply(cropper.setValue, cropper, [given]);
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
    const state = cropper.getCropState();
    const crop = cropper.getPixelCrop();
    let canceled = false;

    cropper.on("change", (_, details) => {
      details.cancel();
      canceled = details.isCanceled;
    });

    cropper.setRotation(10);
    time.frames(2);
    expect(canceled).toBeTruthy();
    expect(cropper.getValue()).toBe(before);
    expect(cropper.getCropState()).toBe(state);
    expect(cropper.getPixelCrop()).toStrictEqual(crop);
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

    cropper.setImage({ ...PHOTO });
    time.frames(2);
    expect(cropper.getValue()).toBe(before);
    expect(change).not.toHaveBeenCalled();
  });

  it("applies a value set before the image loads", () => {
    const time = fakeClock();
    const cropper = createCropper({ clock: time.clock });

    cropper.setValue({ rotation: 10 });
    cropper.setImage(PHOTO);
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

    late.cropper.setImage(PHOTO);
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps frames and commits going past a throwing change listener", () => {
    const errors = reported();
    const { commit, cropper, time } = setup();
    const later = vi.fn<() => void>();
    const frame = vi.fn<() => void>();

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
    const settle = vi.fn<() => void>();

    cropper.on("commit", boom);
    cropper.on("settle", settle);
    cropper.setRotation(5);
    cropper.run(() => false);
    time.frame();
    expect(settle).toHaveBeenCalledOnce();
    expect(cropper.getState().settling).toBeFalsy();
    expect(errors).toHaveLength(1);
  });

  it("drops a throwing task and keeps the frame loop", () => {
    const errors = reported();
    const { commit, cropper, time } = setup();
    const task = vi.fn<() => boolean>(boom);

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

  it("finishes a write past a throwing subscriber and runs the next one", () => {
    const errors = reported();
    const { cropper } = setup();
    const next = vi.fn<() => void>();

    cropper.subscribe(boom);
    cropper.subscribe(next);
    cropper.flip();
    expect(cropper.getValue().mirrored).toBeTruthy();
    expect(next).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });

  it("returns from a listener that removes and adds itself during an emit", () => {
    const { cropper } = setup();
    const spy = vi.fn<() => void>();
    let off = nothing;

    const rearm = (): void => {
      spy();
      off();
      off = cropper.on("stop", rearm);
    };

    off = cropper.on("stop", rearm);
    cropper.stop();
    cropper.stop();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns from a subscriber that resubscribes during a refresh", () => {
    const { cropper } = setup();
    const spy = vi.fn<() => void>();
    let off = nothing;

    const rearm = (): void => {
      spy();
      off();
      off = cropper.subscribe(rearm);
    };

    off = cropper.subscribe(rearm);
    cropper.flip();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("skips a listener another listener removed, and holds a new one for next time", () => {
    const { cropper } = setup();
    const removed = vi.fn<() => void>();
    const added = vi.fn<() => void>();
    let off = nothing;

    cropper.on("stop", () => {
      off();
      cropper.on("stop", added);
    });

    off = cropper.on("stop", removed);
    cropper.stop();
    expect(removed).not.toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
  });
});

describe("destroy", () => {
  it("holds nothing added after it ran", () => {
    const { cropper } = setup();

    cropper.destroy();
    const listener = vi.fn<() => void>();
    const offs = [
      cropper.on("stop", listener),
      cropper.on("stop", listener),
      cropper.subscribe(listener),
      cropper.subscribe(listener),
    ];

    expect(new Set(offs).size).toBe(1);
    expect(offs[0]).toBeTypeOf("function");
    cropper.stop();
    cropper.flip();
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores a stop made while it runs", () => {
    const { cropper } = setup();
    const heard = vi.fn<() => void>();

    cropper.on("stop", heard);
    cropper.on("gestureend", heard);

    cropper.on("destroy", () => {
      cropper.stop();
    });

    cropper.begin("pan");
    cropper.destroy();
    expect(heard).not.toHaveBeenCalled();
  });

  it("fires once when a listener or plugin destroys again", () => {
    const spy = vi.fn<() => void>();
    const { cropper } = setup({
      plugins: [
        {
          destroy() {
            spy();
            cropper.destroy();
          },
          init: () => {},
          name: "again",
        },
      ],
    });
    const fired = vi.fn<() => void>(() => {
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
      init: () => {},
      name: "next",
      seen: false,
    };
    const { change, cropper, time } = setup({
      plugins: [
        {
          destroy() {
            throw new Error("plugin failed");
          },
          init: () => {},
          name: "bad",
        },
        next,
      ],
    });
    const fired = vi.fn<() => void>();

    cropper.on("destroy", fired);
    cropper.destroy();
    vi.unstubAllGlobals();
    cropper.setRotation(10);
    time.frames(2);
    expect(next.seen).toBeTruthy();
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

    expect([before.interacting, cropper.getState().interacting]).toStrictEqual([
      "pan",
      null,
    ]);

    const task = vi.fn<() => boolean>(() => true);

    cropper.run(task)();
    cropper.setOptions({ disabled: true, maxZoom: 2 });
    cropper.stop();
    cropper.on("commit", vi.fn<() => void>())();
    cropper.subscribe(vi.fn<() => void>())();
    time.frames(3);
    expect(task).not.toHaveBeenCalled();

    expect(cropper.getState()).toMatchObject({
      disabled: false,
      settling: false,
    });

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
    const order: string[] = [];

    cropper.on("commit", (value) => {
      order.push(`commit ${value.rotation}`);
    });

    cropper.on("change", (value) => {
      order.push(`change ${value.rotation}`);

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

    expect(order).toStrictEqual(["change 20", "change 10", "commit 10"]);
  });

  it("reports the next move after a silent write inside a change listener", () => {
    const { change, cropper, time } = setup();

    cropper.on("change", (value) => {
      if (value.rotation > 10) {
        cropper.setRotation(10, { emit: false });
      }
    });

    cropper.setRotation(20);
    time.frame();
    expect(cropper.getValue().rotation).toBe(10);
    change.mockClear();
    cropper.setRotation(20);
    time.frame();
    expect(change.mock.calls[0]?.[0].rotation).toBe(20);
    expect(change.mock.calls[0]?.[1].previous.rotation).toBe(10);
    expect(change.mock.calls[0]?.[1].changed).toContain("rotation");
  });

  it("lists only what moved after a silent write inside a change listener", () => {
    const { change, cropper, time } = setup();
    const off = cropper.on("change", () => {
      off();
      cropper.setRotation(10, { emit: false });
    });

    cropper.setRotation(20);
    time.frame();
    change.mockClear();
    cropper.setZoom(1.5);
    time.frame();
    expect(change.mock.calls[0]?.[1].previous.rotation).toBe(10);
    expect(change.mock.calls[0]?.[1].changed).not.toContain("rotation");
  });

  it("cancels back to a silent write made inside a change listener", () => {
    const { commit, cropper, time } = setup();
    const offClamp = cropper.on("change", () => {
      offClamp();
      cropper.setRotation(10, { emit: false });
    });

    cropper.setRotation(20);
    time.frame();

    cropper.on("change", (_, details) => {
      details.cancel();
    });

    cropper.setRotation(30);
    time.frames(2);
    expect(cropper.getValue().rotation).toBe(10);
    expect(cropper.getState().committed.rotation).toBe(10);
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(["change", "frame"] as const)(
    "fires settle when a %s listener writes on the last task frame",
    (type) => {
      const { cropper, time } = setup();
      const settle = vi.fn<() => void>();

      cropper.on("settle", settle);
      const off = cropper.on(type, () => {
        off();
        cropper.setRotation(5);
      });

      cropper.setRotation(3);
      cropper.run(() => false);
      time.frames(2);
      expect(cropper.getState().settling).toBeFalsy();
      expect(settle).toHaveBeenCalledOnce();
    }
  );

  it("lists only the field that moved after a value with long decimals", () => {
    const { change, cropper, time } = setup({
      image: { height: 1000, width: 1000 },
    });

    cropper.setValue({
      size: { height: 0.3, width: 0.19416446166578682 },
    });

    time.frame();
    const { size } = cropper.getValue();

    change.mockClear();
    cropper.flip();
    time.frame();
    expect(change.mock.calls[0]?.[1].changed).toStrictEqual(["mirrored"]);
    expect(cropper.getValue().size).toStrictEqual(size);
  });

  it("keeps a held angle out of the fields a zoom moves", () => {
    const { change, cropper, time } = setup();
    const rotation = 1.1234567890123457;

    cropper.setValue({ rotation });
    time.frame();
    change.mockClear();
    cropper.setZoom(2);
    time.frame();
    expect(change.mock.calls[0]?.[1].changed).not.toContain("rotation");
    expect(cropper.getValue().rotation).toBe(rotation);
  });

  it("holds a round trip on a very long photo with a locked aspect", () => {
    const { change, commit, cropper, time } = setup({
      image: { height: 3, width: 1_000_000 },
      value: { ...defaultValue, aspect: 16 / 9 },
    });

    time.frame();
    const held = cropper.getValue();

    for (let write = 0; write < 3; write += 1) {
      cropper.setValue(cropper.getValue());
      time.frame();
    }

    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(cropper.getValue().size).toStrictEqual(held.size);
  });

  it("holds a change below a pixel's rounding and reports one above it", () => {
    const { change, cropper, time } = setup({
      value: {
        ...defaultValue,
        center: { x: 0.4, y: 0.4 },
        size: { height: 0.5, width: 0.5 },
      },
    });

    time.frame();

    const nudge = (x: number, y: number): void => {
      cropper.setValue({ center: { x: 0.4 + x, y: 0.4 + y } });
      time.frame();
    };

    nudge(1e-11, 2e-11);
    expect(change).not.toHaveBeenCalled();
    expect(cropper.getValue().center).toStrictEqual({ x: 0.4, y: 0.4 });
    nudge(1e-10, 0);
    expect(change.mock.calls[0]?.[1].changed).toStrictEqual(["center"]);
    change.mockClear();
    cropper.setValue({ center: { x: 0.4, y: 0.4 } });
    time.frame();
    change.mockClear();
    nudge(0, 1e-10);
    expect(change.mock.calls[0]?.[1].changed).toStrictEqual(["center"]);
  });

  it("reports a small move along a very long photo", () => {
    const { change, cropper, time } = setup({
      image: { height: 3, width: 1_000_000 },
      value: {
        ...defaultValue,
        center: { x: 0.4, y: 0.5 },
        size: { height: 1, width: 0.5 },
      },
    });

    time.frame();
    cropper.setValue({ center: { x: 0.4 + 1e-9, y: 0.5 } });
    time.frame();
    expect(change.mock.calls[0]?.[1].changed).toStrictEqual(["center"]);
  });

  it("reports ten pixels of width on a very long photo", () => {
    const { change, cropper, time } = setup({
      image: { height: 3, width: 1_000_000 },
      value: { ...defaultValue, size: { height: 1, width: 0.5 } },
    });

    time.frame();
    cropper.setValue({ size: { height: 1, width: 0.5 + 1e-5 } });
    time.frame();
    expect(change.mock.calls[0]?.[1].changed).toStrictEqual(["size"]);
  });

  it("holds a crop on a long photo through the slack of its short side", () => {
    const { change, cropper, time } = setup({
      image: { height: 100, width: 20_000 },
    });

    cropper.setRotation(7.5e-12);
    cropper.setZoom(6.8102518945089665);
    cropper.panBy(-0.8531595559399789, -0.8531595559399789 / 2);
    time.frames(2);
    change.mockClear();
    cropper.setValue(cropper.getValue());
    time.frames(2);
    expect(change).not.toHaveBeenCalled();
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

describe("input validation", () => {
  const bad = Number.NaN;
  const huge = Number.POSITIVE_INFINITY;

  it.each<[string, (cropper: Cropper) => void]>([
    [
      "setRotation(NaN)",
      (c) => {
        c.setRotation(bad);
      },
    ],
    [
      "setZoom(NaN)",
      (c) => {
        c.setZoom(bad);
      },
    ],
    [
      "a NaN anchor",
      (c) => {
        c.setZoom(2, { anchor: { x: bad, y: 0.5 } });
      },
    ],
    [
      "panBy(NaN)",
      (c) => {
        c.panBy(bad, 0);
      },
    ],
    [
      "a NaN crop x",
      (c) => {
        withCrop(c, { x: bad });
      },
    ],
    [
      "a NaN crop width",
      (c) => {
        withCrop(c, { width: bad });
      },
    ],
    [
      "a NaN field",
      (c) => {
        c.setValue({ rotation: bad });
      },
    ],
    [
      "a NaN center",
      (c) => {
        c.setValue({ center: { x: bad, y: 0.7 } });
      },
    ],
    [
      "a NaN tilt",
      (c) => {
        c.setValue({ perspective: { horizontal: bad, vertical: 0 } });
      },
    ],
  ])("ignores %s and leaves the crop where it was", (_, write) => {
    const { change, commit, cropper, time } = setup({
      defaultValue: {
        center: { x: 0.3, y: 0.7 },
        size: { height: 0.2, width: 0.2 },
      },
    });
    const before = cropper.getValue();

    write(cropper);
    time.frames(2);
    expect(cropper.getValue()).toStrictEqual(before);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it.each<[string, (cropper: Cropper) => void]>([
    [
      "setRotation(Infinity)",
      (c) => {
        c.setRotation(huge);
      },
    ],
    [
      "setRotation(1e308)",
      (c) => {
        c.setRotation(1e308);
      },
    ],
    [
      "panBy(Infinity)",
      (c) => {
        c.panBy(huge, 0);
      },
    ],
    [
      "panBy(1e200)",
      (c) => {
        c.panBy(1e200, 0);
      },
    ],
    [
      "panBy(1e308)",
      (c) => {
        c.panBy(1e308, -1e308);
      },
    ],
    [
      "a huge anchor",
      (c) => {
        c.setZoom(2, { anchor: { x: 1e200, y: -1 } });
      },
    ],
    [
      "a tiny zoom with a huge anchor",
      (c) => {
        c.setZoom(1.0000000000000002, { anchor: { x: 1e200, y: -1 } });
      },
    ],
    [
      "a huge crop x",
      (c) => {
        withCrop(c, { x: 1e200 });
      },
    ],
    [
      "a huge crop size",
      (c) => {
        withCrop(c, { height: 1e308, width: 1e308 });
      },
    ],
    [
      "a huge center",
      (c) => {
        c.setValue({ center: { x: 1e200, y: 0.5 } });
      },
    ],
    [
      "a huge size",
      (c) => {
        c.setValue({ size: { height: 0.5, width: 1e308 } });
      },
    ],
    [
      "a size of 0",
      (c) => {
        c.setValue({ size: { height: 0, width: 0 } });
      },
    ],
    [
      "a negative size",
      (c) => {
        c.setValue({ size: { height: -0.5, width: 1 } });
      },
    ],
    [
      "a size with no sides",
      (c) => {
        loose(c, { size: {} });
      },
    ],
    [
      "a center with no y",
      (c) => {
        loose(c, { center: { x: 0.2 } });
      },
    ],
  ])("keeps the crop on the photo after %s", (_, write) => {
    const { change, commit, cropper, time } = setup();

    cropper.setZoom(2);
    time.frames(2);
    write(cropper);
    time.frames(2);
    expectValid(cropper);

    for (const [value] of [...change.mock.calls, ...commit.mock.calls]) {
      expect(sound(value)).toBeTruthy();
    }
  });

  it("clamps an infinite angle to the limit", () => {
    const { cropper } = setup();

    cropper.setRotation(huge);
    expect(cropper.getValue().rotation).toBe(45);
    cropper.setRotation(-huge);
    expect(cropper.getValue().rotation).toBe(-45);
  });

  it("keeps working after a write it ignored", () => {
    const { cropper, time } = setup();

    cropper.setRotation(bad);
    time.frame();
    cropper.setRotation(5);
    cropper.setZoom(2);
    cropper.panBy(0.01, 0);
    expectValid(cropper);
    expect(cropper.getValue().rotation).toBe(5);
    expect(serialize(cropper.getValue())).not.toContain("null");
  });

  it.each<[string, Partial<CropValue>]>([
    ["rotation", { rotation: bad }],
    ["size", { size: { height: 0, width: 0 } }],
    ["negative size", { size: { height: -1, width: -1 } }],
    ["center", { center: { x: huge, y: bad } }],
    ["aspect", { aspect: bad }],
    ["huge center", { center: { x: 1e308, y: 1e151 } }],
  ])("starts valid and resets valid from a bad defaultValue %s", (_, given) => {
    const { cropper } = setup({ defaultValue: given });

    expectValid(cropper);
    cropper.reset();
    expectValid(cropper);
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("treats a bad value option like a bad defaultValue", () => {
    const { cropper } = setup({
      value: { ...defaultValue, rotation: bad, size: { height: 0, width: 1 } },
    });

    expectValid(cropper);
    expect(cropper.getValue().rotation).toBe(0);
  });

  it.each([
    "aspect",
    "center",
    "mirrored",
    "perspective",
    "quarterTurns",
    "rotation",
    "size",
  ])("reads an undefined %s as not given", (key) => {
    const { cropper } = setup({ image: null });

    loose(cropper, { [key]: undefined });
    cropper.setImage(PHOTO);
    expect(cropper.getValue()).toStrictEqual(defaultValue);
    const { cropper: later } = setup({ defaultValue: { rotation: 10 } });
    const before = later.getValue();

    loose(later, { [key]: undefined });
    expect(later.getValue()).toStrictEqual(before);
    const fresh = createCropper({
      clock: fakeClock().clock,
      defaultValue: { [key]: undefined },
      image: PHOTO,
    });

    expect(fresh.getValue()).toStrictEqual(defaultValue);
  });

  it("stores a usable value as given before a photo and fixes it on arrival", () => {
    const { cropper } = setup({ image: null });

    cropper.setValue({ rotation: 60 });
    expect(cropper.getValue().rotation).toBe(60);
    cropper.setValue({ rotation: bad });
    expect(cropper.getValue().rotation).toBe(60);
    cropper.setImage(PHOTO);
    expect(cropper.getValue().rotation).toBe(45);
  });

  it.each([0, -1.5, huge, -huge, bad, 1e14, 1e-14, 1e200])(
    "turns an aspect of %s into free on every path",
    (ratio) => {
      const { cropper } = setup();

      cropper.setAspect(ratio);
      expect(cropper.getValue().aspect).toBe("free");
      expectValid(cropper);
      cropper.setAspect(1);
      cropper.setValue({ aspect: ratio });
      expect(cropper.getValue().aspect).toBe("free");
      expectValid(cropper);
      const { cropper: fresh } = setup({ defaultValue: { aspect: ratio } });

      expect(fresh.getValue().aspect).toBe("free");
      expectValid(fresh);
    }
  );

  it.each([1.5, 1e-3, 1e3, 1e6, 1e-6])("keeps a ratio of %s", (ratio) => {
    const { cropper } = setup();

    cropper.setAspect(ratio);
    expect(cropper.getValue().aspect).toBe(ratio);
    expect(cropper.getValue().size.width).toBeGreaterThan(0);
    expect(cropper.getValue().size.height).toBeGreaterThan(0);
  });

  it("keeps a thin crop's size above 0 on a very long photo", () => {
    const { cropper } = setup({
      defaultValue: { aspect: 0.2 },
      image: { height: 1, width: 1e12 },
    });
    const { size } = cropper.getValue();

    expect(size.width).toBeGreaterThan(0);
    const { cropper: restored } = setup({
      image: { height: 1, width: 1e12 },
      value: cropper.getValue(),
    });

    expect(restored.getValue().size.width).toBeGreaterThan(0);
  });

  it.each<[string, CropperOptions]>([
    ["maxZoom 0", { maxZoom: 0 }],
    ["maxZoom NaN", { maxZoom: bad }],
    ["maxZoom -1", { maxZoom: -1 }],
    ["minSize NaN", { minSize: { height: bad, width: bad } }],
    ["minSize 0", { minSize: { height: 0, width: 0 } }],
    ["minSize -1", { minSize: { height: -1, width: -1 } }],
    ["focalLength 0", { focalLength: 0 }],
    ["focalLength NaN", { focalLength: bad }],
    ["focalLength -26", { focalLength: -26 }],
  ])("stays valid and writable with %s", (_, options) => {
    const { cropper, time } = setup(options);

    expectValid(cropper);
    cropper.setValue({ perspective: { horizontal: 10, vertical: 10 } });
    cropper.setRotation(5);
    time.frame();
    expectValid(cropper);
    expect(cropper.getValue().rotation).toBe(5);
    expectTilted(cropper);
    expect(cropper.getMaxZoom()).toBeGreaterThanOrEqual(1);
    cropper.reset();
    expectValid(cropper);
    const { cropper: later } = setup();

    later.setOptions(options);
    later.setRotation(5);
    later.setValue({ perspective: { horizontal: 10, vertical: 10 } });
    expect(later.getValue().rotation).toBe(5);
    expectTilted(later);
    expectValid(later);
  });

  it.each([
    ["Infinity", huge, 0, 0.75, 0.5],
    ["1e200", 1e200, 0, 0.75, 0.5],
    ["opposite infinities", huge, -huge, 0.75, 0.25],
    ["opposite 1e308", 1e308, -1e308, 0.75, 0.25],
    ["same sign 1e308", 1e308, 1e308, 0.75, 0.75],
  ])("lands on the edge a pan of %s points at", (_, dx, dy, x, y) => {
    const { cropper } = setup();

    cropper.setZoom(2);
    cropper.panBy(dx, dy);
    expect(cropper.getValue().center).toStrictEqual({ x, y });
  });

  it.each([
    [0, 1],
    [-3, 1],
    [0.5, 1],
    [bad, 15],
  ])("reads a maxZoom of %s as %s", (maxZoom, cap) => {
    expect(setup({ maxZoom }).cropper.getMaxZoom()).toBe(cap);
  });

  it.each([
    ["a string", "x"],
    ["a number", 1],
    ["nothing", undefined],
  ])("keeps a mirror from %s out of the value", (_, flip) => {
    const { cropper } = setup();
    const state = cropState(cropper.getCropState());

    Reflect.apply(cropper.setCropState, cropper, [{ ...state, flip }]);
    expect(cropper.getValue().mirrored).toBeFalsy();
  });

  it("lets maxZoom Infinity through", () => {
    const { cropper } = setup({ maxZoom: huge });

    expect(cropper.getMaxZoom()).toBe(huge);
    cropper.setZoom(30);
    expect(cropper.getZoom()).toBeCloseTo(30, 6);
  });

  it("holds the centre when a rotation above the limit is set", () => {
    const { cropper } = setup({
      image: { height: 1000, width: 1000 },
      value: {
        ...defaultValue,
        center: { x: 0.7, y: 0.5 },
        size: { height: 0.2, width: 0.2 },
      },
    });

    cropper.setValue({ rotation: 90 });
    expect(cropper.getValue().rotation).toBe(45);
    expect(cropper.getValue().center.x).toBeCloseTo(0.7, 9);
    expect(cropper.getValue().center.y).toBeCloseTo(0.5, 9);
    const { cropper: fresh } = setup({
      defaultValue: {
        center: { x: 0.7, y: 0.5 },
        rotation: 225,
        size: { height: 0.2, width: 0.2 },
      },
      image: { height: 1000, width: 1000 },
    });

    expect(fresh.getValue().center.x).toBeCloseTo(0.7, 9);
    fresh.reset();
    expect(fresh.getValue().center.x).toBeCloseTo(0.7, 9);
  });

  const nasty = oneof(
    constantFrom(
      bad,
      huge,
      -huge,
      1e308,
      -1e308,
      5e-324,
      -5e-324,
      0,
      -0,
      0.5,
      2,
      5
    ),
    double({ max: 10, min: -10, noNaN: true })
  );

  const write = oneof(
    tuple(
      constantFrom<(c: Cropper, a: number, b: number) => void>(
        (c, a) => {
          c.setRotation(a);
        },
        (c, a) => {
          c.setZoom(a);
        },
        (c, a, b) => {
          c.setZoom(2, { anchor: { x: a, y: b } });
        },
        (c, a, b) => {
          c.panBy(a, b);
        },
        (c, a, b) => {
          c.setValue({ center: { x: a, y: b } });
        },
        (c, a, b) => {
          c.setValue({ size: { height: a, width: b } });
        },
        (c, a, b) => {
          c.setValue({ perspective: { horizontal: a, vertical: b } });
        },
        (c, a) => {
          c.setValue({ rotation: a });
        },
        (c, a) => {
          c.setValue({ aspect: a });
        },
        (c, a) => {
          c.setAspect(a);
        },
        (c, a) => {
          c.setOptions({ maxZoom: a });
        },
        (c, a, b) => {
          c.setOptions({ minSize: { height: a, width: b } });
        }
      ),
      nasty,
      nasty
    ),
    tuple(
      constant<(c: Cropper) => void>((c) => {
        c.reset();
      }),
      constant(0),
      constant(0)
    )
  );

  it("stays valid through any sequence of writes", () => {
    fcAssert(
      property(array(write, { maxLength: 8, minLength: 1 }), (sequence) => {
        const { change, commit, cropper, time } = setup();

        for (const [run, a, b] of sequence) {
          run(cropper, a, b);
          time.frame();
          expect(sound(cropper.getValue())).toBeTruthy();
        }

        for (const [value] of [...change.mock.calls, ...commit.mock.calls]) {
          expect(sound(value)).toBeTruthy();
        }
      })
    );
  });

  it("stays valid when any writes come before the photo", () => {
    fcAssert(
      property(array(write, { maxLength: 4, minLength: 1 }), (sequence) => {
        const { cropper } = setup({ image: null });

        for (const [run, a, b] of sequence) {
          run(cropper, a, b);
        }

        cropper.setImage(PHOTO);
        expect(sound(cropper.getValue())).toBeTruthy();
      })
    );
  });
});

describe("large photos", () => {
  it.each<[string, CropperOptions["image"], Partial<CropValue>]>([
    ["level", { height: 65_535, width: 32_767 }, { rotation: 1.3335e-11 }],
    [
      "a tiny angle",
      { height: 1_000_000, width: 300_000 },
      { rotation: 1e-12 },
    ],
    [
      "a tilt",
      { height: 1e8, width: 1e8 },
      { perspective: { horizontal: 0, vertical: -30 } },
    ],
    [
      "a thin photo near the limit",
      { height: 1e8, width: 2 },
      { quarterTurns: 1, rotation: 44.999 },
    ],
    [
      "a tilt on a thin photo",
      { height: 75_274_033, width: 14 },
      { perspective: { horizontal: -17.6, vertical: 30 } },
    ],
  ])("keeps the crop covered at a corner with %s", (_, image, first) => {
    const { cropper } = setup({ image });

    cropper.setValue(first);
    cropper.setValue({ center: { x: 0, y: 0 } });
    expect(isCropCovered(cropState(cropper.getCropState()))).toBeTruthy();
  });

  it("keeps any tiny angle or tilt on any large photo covered", () => {
    fcAssert(
      property(
        record({
          height: integer({ max: 2_147_483_647, min: 1 }),
          horizontal: oneof(
            constant(0),
            double({ max: 30, min: -30, noNaN: true })
          ),
          rotation: double({ max: 1e-6, min: -1e-6, noNaN: true }),
          turns: constantFrom<QuarterTurns>(0, 1, 2, 3),
          vertical: oneof(
            constant(0),
            double({ max: 30, min: -30, noNaN: true })
          ),
          width: integer({ max: 2_147_483_647, min: 1 }),
          x: constantFrom(0, 0.5, 1),
          y: constantFrom(0, 0.5, 1),
        }),
        ({ height, horizontal, rotation, turns, vertical, width, x, y }) => {
          const { cropper } = setup({ image: { height, width } });

          cropper.setValue({
            perspective: { horizontal, vertical },
            quarterTurns: turns,
            rotation,
          });

          cropper.setValue({ center: { x, y } });

          expect(
            isCropCovered(
              cropState(cropper.getCropState()),
              Math.max(1e-9, 2e-8 / Math.max(width, height))
            )
          ).toBeTruthy();
        }
      )
    );
  });
});

describe("short lens", () => {
  it.each([13, 6, 0.5])(
    "keeps a %s mm crop on the photo at full tilt",
    (mm) => {
      const { cropper } = setup({
        defaultValue: { perspective: { horizontal: 30, vertical: 30 } },
        focalLength: mm,
      });
      const state = cropState(cropper.getCropState());

      expect(isCropCovered(state)).toBeTruthy();
      const { center } = cropper.getValue();

      expect(Math.abs(center.x - 0.5)).toBeLessThan(0.5);
      expect(Math.abs(center.y - 0.5)).toBeLessThan(0.5);

      expect(
        isPerspectiveValid(state.image, state.perspective, 0.05)
      ).toBeTruthy();
    }
  );

  it("uses the lens as given when it is long enough", () => {
    const { cropper } = setup({
      defaultValue: { perspective: { horizontal: 30, vertical: 30 } },
    });

    expect(cropper.getCropState()?.perspective.focal).toBeCloseTo(
      (26 / 36) * 4000,
      9
    );
  });
});

describe("setCropState", () => {
  it("keeps the aspect the value holds", () => {
    const { cropper } = setup();
    const state = cropState(cropper.getCropState());

    cropper.setCropState({ ...state, aspect: 2 });
    expect(cropper.getCropState()?.aspect).toBeNull();
    cropper.setAspect(1);
    const locked = cropState(cropper.getCropState());

    cropper.setCropState({
      ...locked,
      aspect: null,
      crop: { ...locked.crop, height: 200, width: 1000 },
    });

    const after = cropState(cropper.getCropState());

    expect(after.aspect).toBe(1);
    expect(after.crop.width).toBeCloseTo(after.crop.height, 6);
    cropper.setValue(cropper.getValue());
    expect(cropper.getCropState()?.crop.width).toBeCloseTo(after.crop.width, 6);
  });

  it("keeps the photo and the lens the cropper holds", () => {
    const { cropper } = setup({
      defaultValue: { perspective: { horizontal: 0, vertical: 20 } },
    });
    const state = cropState(cropper.getCropState());

    cropper.setCropState({
      ...state,
      image: { height: 10, width: 10 },
      perspective: { ...state.perspective, focal: 100 },
    });

    const after = cropState(cropper.getCropState());

    expect(after.image).toStrictEqual(PHOTO);
    expect(after.perspective.focal).toBe(state.perspective.focal);
  });

  it("whole-numbers the turns it is given", () => {
    const { cropper } = setup();
    const state = cropState(cropper.getCropState());

    Reflect.apply(cropper.setCropState, cropper, [{ ...state, turns: 5 }]);
    expect(cropper.getCropState()?.turns).toBe(1);
    expect(cropper.getValue().quarterTurns).toBe(1);
  });
});

describe("round trips", () => {
  it("sends nothing when a crop on a limit is written back", () => {
    const { change, commit, cropper, time } = onTheEdge();
    const before = cropper.getValue();

    cropper.setValue(before);
    time.frames(3);
    expect(cropper.getValue()).toBe(before);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("brings a saved crop on a limit back exactly", () => {
    const { cropper } = onTheEdge();
    const saved = parse(serialize(cropper.getValue())) ?? defaultValue;

    expect(setup({ value: saved }).cropper.getValue()).toStrictEqual(saved);
    expect(saved).not.toBe(defaultValue);
  });

  it("returns exactly to a stored crop", () => {
    const { cropper, time } = onTheEdge();
    const stored = cropper.getValue();

    cropper.setRotation(3);
    time.frames(3);
    cropper.setValue(stored, { reason: "history" });
    time.frames(3);
    expect(cropper.getValue()).toStrictEqual(stored);
  });

  it("sends nothing for a new photo of the same size", () => {
    const { change, commit, cropper, time } = onTheEdge();
    const before = cropper.getValue();

    cropper.setImage({ ...PHOTO });
    time.frames(3);
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(cropper.getValue()).toBe(before);
  });

  it("stays quiet on any crop written back, on any photo shape", () => {
    fcAssert(
      property(
        record({
          angle: double({ max: 45, min: -45, noNaN: true }),
          image: constantFrom(
            PHOTO,
            { height: 30, width: 40 },
            { height: 100, width: 20_000 },
            { height: 3024, width: 4032 }
          ),
          pan: double({ max: 3, min: -3, noNaN: true }),
          zoom: double({ max: 15, min: 1, noNaN: true }),
        }),
        ({ angle, image, pan, zoom }) => {
          const { change, commit, cropper, time } = setup({ image });

          cropper.setRotation(angle);
          cropper.setZoom(zoom);
          cropper.panBy(pan, pan / 2);
          time.frames(2);
          change.mockClear();
          commit.mockClear();
          cropper.setValue(cropper.getValue());
          time.frames(2);
          expect(change).not.toHaveBeenCalled();
          expect(commit).not.toHaveBeenCalled();
        }
      )
    );
  });

  it("stays quiet when a held tilt moved the crop limit on a long photo", () => {
    const { change, cropper, time } = setup({
      image: { height: 100, width: 20_000 },
    });

    cropper.setRotation(1.2095e-9);
    cropper.setZoom(14.999999945559717);
    cropper.panBy(0.4666666666875, 0.23333333334375);
    time.frames(2);
    change.mockClear();
    cropper.setValue(cropper.getValue());
    time.frames(2);
    expect(change).not.toHaveBeenCalled();
  });

  it.each([
    [
      -0.000018614188500000004,
      { height: 100, width: 20_000 },
      0.000032483463526374626,
    ],
    [0.0004974819465, { height: 3000, width: 4000 }, -0.000002532001256004277],
    [-0.08214960909350001, { height: 30, width: 40 }, -3.1825326864062767e-7],
  ])(
    "stays quiet when the solver slack just passes the hold at %d",
    (angle, image, pan) => {
      const { change, cropper, time } = setup({ image });

      cropper.setRotation(angle);
      cropper.panBy(pan, pan / 2);
      time.frames(2);
      change.mockClear();
      cropper.setValue(cropper.getValue());
      time.frames(2);
      expect(change).not.toHaveBeenCalled();
    }
  );

  it("stays pristine when the default crop is written back", () => {
    const { cropper, time } = setup({
      defaultValue: { center: { x: 0.9, y: 0.9 }, rotation: 12 },
      image: { height: 4032, width: 3024 },
    });

    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setValue(cropper.getValue());
    time.frames(2);
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("is pristine again after four turns when a side rounds to the next step", () => {
    const { cropper } = setup({ defaultValue: { aspect: 6.650816071338371 } });

    for (let turn = 0; turn < 4; turn += 1) {
      cropper.rotate90();
    }

    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("is pristine again after four turns on a ratio whose inverse drifts", () => {
    fcAssert(
      property(double({ max: 8, min: 0.125, noNaN: true }), (ratio) => {
        const { cropper } = setup({ defaultValue: { aspect: ratio } });

        for (let turn = 0; turn < 4; turn += 1) {
          cropper.rotate90();
        }

        expect(sameAspect(cropper.getValue().aspect, ratio)).toBeTruthy();
        expect(cropper.getState().pristine).toBeTruthy();
      })
    );
  });

  it("tells close ratios from far ones and names apart", () => {
    expect(sameAspect(1.85, 1.8500000000000003)).toBeTruthy();
    expect(sameAspect(1.85, 1.86)).toBeFalsy();
    expect(sameAspect("free", "free")).toBeTruthy();
    expect(sameAspect("free", 1)).toBeFalsy();
  });
});

describe("anchored zoom", () => {
  const minSize = { height: 1500, width: 2000 };

  it("does not pan when the minSize ceiling stops the zoom", () => {
    const { cropper } = setup({ minSize });

    cropper.setZoom(2);
    const before = cropState(cropper.getCropState()).crop;

    cropper.setZoom(4, { anchor: { x: 0, y: 0 } });
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    expect(cropState(cropper.getCropState()).crop).toStrictEqual(before);
  });

  it("holds the anchor when the zoom stops short of the request", () => {
    const { cropper } = setup({ minSize });

    cropper.setZoom(4, { anchor: { x: 0.25, y: 0.25 } });
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    const { center } = cropper.getValue();

    expect(center.x).toBeCloseTo(0.375, 9);
    expect(center.y).toBeCloseTo(0.375, 9);
  });

  it("leaves the centre alone when a side at the minimum stops the zoom", () => {
    const { cropper } = setup(square(300));

    cropper.setValue({
      center: { x: 0.5, y: 0.3 },
      size: { height: 0.3, width: 0.8 },
    });

    cropper.setZoom(2, { anchor: { x: 0.5, y: 0.15 } });
    expect(pixels(cropper)).toStrictEqual({ height: 300, width: 800 });
    expect(cropper.getValue().center.y).toBeCloseTo(0.3, 9);
  });

  it("holds the anchor when the zoom is reached", () => {
    const { cropper } = setup();

    cropper.setZoom(2, { anchor: { x: 0.25, y: 0.75 } });
    const { center } = cropper.getValue();

    expect(center.x).toBeCloseTo(0.375, 9);
    expect(center.y).toBeCloseTo(0.625, 9);
  });
});

describe("minSize on a free crop", () => {
  it("holds the short side of a long crop", () => {
    const { cropper } = setup(square(100));

    cropper.setValue({ size: { height: 1, width: 0.01 } });
    expect(pixels(cropper)).toStrictEqual({ height: 1000, width: 100 });
  });

  it("raises only the side under the minimum", () => {
    const { cropper } = setup(square(100));

    cropper.setValue({ size: { height: 0.2, width: 0.05 } });
    expect(pixels(cropper)).toStrictEqual({ height: 200, width: 100 });
  });

  it("keeps both sides when the photo cannot hold the minimum at a quarter turn", () => {
    const { cropper } = setup({
      image: { height: 200, width: 2000 },
      minSize: { height: 300, width: 300 },
      value: { ...defaultValue, quarterTurns: 1 },
    });
    const state = cropState(cropper.getCropState());
    const crop = { ...state.crop, height: 740 };

    cropper.setCropState({ ...state, crop });
    expect(cropState(cropper.getCropState()).crop.height).toBeCloseTo(740);
    expect(cropState(cropper.getCropState()).crop.width).toBeCloseTo(200);
  });

  it("holds a minimum that only just fits at the straighten limit", () => {
    const { cropper } = setup({
      image: { height: 365, width: 6122 },
      minSize: { height: 300, width: 300 },
      value: {
        ...defaultValue,
        rotation: 30,
        size: { height: 0.83, width: 0.056 },
      },
    });
    const { crop } = cropState(cropper.getCropState());

    expect(crop.height).toBeGreaterThanOrEqual(300 - 1e-9);
    expect(crop.width).toBeGreaterThanOrEqual(300 - 1e-9);
  });

  it("holds it from setCropState and defaultValue too", () => {
    const { cropper } = setup(square(100));
    const state = cropState(cropper.getCropState());

    cropper.setCropState({ ...state, crop: { ...state.crop, width: 10 } });
    expect(pixels(cropper).width).toBe(100);
    const { cropper: fresh } = setup({
      ...square(200),
      defaultValue: { size: { height: 1, width: 0.05 } },
    });

    expect(pixels(fresh)).toStrictEqual({ height: 1000, width: 200 });
  });

  it("holds the minimum and the coverage on any crop", () => {
    fcAssert(
      property(
        record({
          angle: double({ max: 45, min: -45, noNaN: true }),
          height: double({ max: 1, min: 0.001, noNaN: true }),
          image: record({
            height: integer({ max: 5000, min: 10 }),
            width: integer({ max: 5000, min: 10 }),
          }),
          minHeight: double({ max: 0.5, min: 0.01, noNaN: true }),
          minWidth: double({ max: 0.5, min: 0.01, noNaN: true }),
          width: double({ max: 1, min: 0.001, noNaN: true }),
        }),
        ({ angle, height, image, minHeight, minWidth, width }) => {
          const minSize = {
            height: minHeight * image.height,
            width: minWidth * image.width,
          };
          const { cropper } = setup({ image, minSize });

          cropper.setValue({ rotation: angle, size: { height, width } });
          const state = cropState(cropper.getCropState());

          expect(isCropCovered(state)).toBeTruthy();
          pre(cropper.getRotationLimit() >= Math.abs(angle));
          expect(state.crop.width).toBeGreaterThanOrEqual(minSize.width - 0.01);

          expect(state.crop.height).toBeGreaterThanOrEqual(
            minSize.height - 0.01
          );
        }
      )
    );
  });

  it("keeps a long crop's shape when a zoom stops at the minimum", () => {
    const { cropper } = setup(square(300));

    cropper.setValue({ size: { height: 0.4, width: 0.8 } });
    cropper.setZoom(2);
    expect(pixels(cropper)).toStrictEqual({ height: 300, width: 600 });
    cropper.setZoom(4);
    expect(pixels(cropper)).toStrictEqual({ height: 300, width: 600 });
    cropper.setZoom(1);
    expect(pixels(cropper)).toStrictEqual({ height: 500, width: 1000 });
  });

  it.each(["size", "center"] as const)(
    "keeps a long crop's shape when a pinch holding %s stops at the minimum",
    (keep) => {
      const { cropper } = setup(square(300));

      cropper.setValue({ size: { height: 0.4, width: 0.8 } });
      const state = cropState(cropper.getCropState());

      cropper.setCropState(
        { ...state, crop: { ...state.crop, height: 200, width: 400 } },
        { keep }
      );

      expect(pixels(cropper)).toStrictEqual({ height: 300, width: 600 });
    }
  );

  it("takes a size given whole from setValue side by side at any shape", () => {
    const { cropper } = setup(square(300));

    cropper.setValue({ size: { height: 0.4, width: 0.8 } });
    cropper.setValue({ size: { height: 0.1, width: 0.2 } });
    expect(pixels(cropper)).toStrictEqual({ height: 300, width: 300 });
  });

  it("keeps the short side of a crop that spans the photo at a tiny angle", () => {
    const { cropper } = setup({
      image: null,
      minSize: { height: 1, width: 4000 },
    });

    cropper.setValue({ rotation: 5e-13 });
    cropper.setImage(PHOTO);
    expect(sound(cropper.getValue())).toBeTruthy();
    expect(cropper.getValue().size.height).toBeCloseTo(1 / 3000, 9);
  });

  it("reports the minimum it holds", () => {
    const { cropper } = setup({ minSize: { height: 100, width: 5000 } });

    expect(cropper.getMinSize()).toStrictEqual({ height: 100, width: 4000 });
    expect(setup().cropper.getMinSize()).toStrictEqual({ height: 1, width: 1 });
  });
});

describe("values handed out", () => {
  it("freezes every value and state the cropper holds", () => {
    const { change, commit, cropper, time } = setup();

    expect(deepFrozen(defaultValue)).toBeTruthy();
    expect(deepFrozen(parse("{}") ?? {})).toBeTruthy();
    expect(deepFrozen(cropper.getValue())).toBeTruthy();
    cropper.setRotation(5);
    time.frame();

    expect(
      [
        cropper.getValue(),
        cropState(cropper.getCropState()),
        change.mock.calls[0]?.[0] ?? {},
        commit.mock.calls[0]?.[0] ?? {},
        cropper.getState().committed,
      ].every(deepFrozen)
    ).toBeTruthy();
  });

  it("keeps away from an object passed in", () => {
    const shared = {
      ...defaultValue,
      center: { x: 0.5, y: 0.5 },
      size: { height: 0.5, width: 0.5 },
    };
    const { cropper } = setup({ image: null, value: shared });

    shared.center.x = 0.1;
    shared.size.width = 0.25;
    expect(cropper.getValue().center.x).toBe(0.5);
    expect(cropper.getValue().size.width).toBe(0.5);
    expect(Object.isFrozen(shared)).toBeFalsy();
    const partial = { center: { x: 0.3, y: 0.3 } };

    cropper.setValue(partial);
    partial.center.x = 0.9;
    expect(cropper.getValue().center.x).toBe(0.3);
  });

  it("keeps a state passed to setCropState away from the cropper", () => {
    const { cropper } = setup();
    const state = cropState(cropper.getCropState());
    const crop = { ...state.crop, width: 2000 };

    cropper.setCropState({ ...state, crop });
    crop.width = 100;
    expect(cropper.getCropState()?.crop.width).not.toBe(100);
    expect(Object.isFrozen(crop)).toBeFalsy();
  });

  it("applies a change written on a copy of the value", () => {
    const { change, commit, cropper, time } = setup({
      value: { ...defaultValue, size: { height: 0.5, width: 0.5 } },
    });

    cropper.setValue({ ...cropper.getValue(), rotation: 2 });
    time.frames(2);
    expect(cropper.getCropState()?.angle).toBe(2);
    expect(cropper.getPixelCrop()?.rotateExpand.degrees).toBe(2);
    expect(change).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
  });
});

describe("frame timing", () => {
  it("hands a task no negative delta when the clock runs backward", () => {
    const steps: ((now: number) => void)[] = [];
    const cropper = createCropper({
      clock: {
        cancel: () => {},
        now: () => 0,
        request: (step) => steps.push(step),
      },
      image: PHOTO,
    });
    const deltas: number[] = [];
    let left = 3;

    cropper.run((_, delta) => {
      deltas.push(delta);
      left -= 1;

      return left > 0;
    });

    for (const now of [100, 50, 80]) {
      steps.shift()?.(now);
    }

    expect(deltas).toStrictEqual([0, 0, 30]);
  });
});

describe("controlled writes around a gesture", () => {
  it("drops a late echo between the end of a gesture and its commit", () => {
    const { clock, frame } = fakeClock();
    const commits: { reason: string; rotation: number }[] = [];
    const cropper = createCropper({ clock, image: PHOTO });

    cropper.on("commit", (value, details) => {
      commits.push({ reason: details.reason, rotation: value.rotation });
    });

    cropper.begin("dial");
    cropper.setRotation(10, { reason: "dial" });
    frame();
    cropper.setRotation(11, { reason: "dial" });
    cropper.end();

    cropper.setValue(
      { ...cropper.getValue(), rotation: 10 },
      { emit: false, reason: "controlled" }
    );

    cropper.setRotation(10, { reason: "controlled" });
    frame();
    expect(cropper.getValue().rotation).toBe(11);
    expect(commits).toStrictEqual([{ reason: "dial", rotation: 11 }]);
  });
});

describe("settle after a canceled task", () => {
  it.each<[string, (cropper: Cropper) => void]>([
    ["nothing", noop],
    [
      "a rotation",
      (cropper) => {
        cropper.setRotation(5);
      },
    ],
    [
      "a zoom",
      (cropper) => {
        cropper.setZoom(2);
      },
    ],
  ])("fires once when %s is written after the cancel", (_name, write) => {
    const { clock, frames } = fakeClock();
    const cropper = createCropper({ clock, image: PHOTO });
    const settle = vi.fn<CropperEvents["settle"]>();

    cropper.on("settle", settle);
    const stop = cropper.run(() => true);

    frames(2);
    stop();
    write(cropper);
    frames(5);

    expect(cropper.getState().settling).toBeFalsy();
    expect(settle).toHaveBeenCalledOnce();
  });
});

describe("reset within the hold tolerance", () => {
  it.each([1e-12, 1e-11, 5e-11])("returns from rotation %d", (rotation) => {
    const { cropper } = setup({
      image: { height: 3024, width: 4032 },
    });

    cropper.setRotation(10);
    cropper.setRotation(rotation);
    cropper.reset();

    expect(cropper.getValue().rotation).toBe(0);
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("returns from a size next to the full photo", () => {
    const { cropper } = setup({
      image: { height: 3024, width: 4032 },
    });

    cropper.setZoom(2);
    cropper.setZoom(1.00000000001);
    cropper.reset();

    expect(cropper.getValue().size).toStrictEqual({ height: 1, width: 1 });
    expect(cropper.getState().pristine).toBeTruthy();
  });
});

describe("destroy inside a listener", () => {
  it("refuses a gesture when the flush at its start destroys the cropper", () => {
    const { cropper } = setup();

    cropper.on("change", () => {
      cropper.destroy();
    });

    cropper.rotate90();

    expect(cropper.begin("pan")).toBeFalsy();
    expect(cropper.getState().interacting).toBeNull();
  });
});

describe("extreme sizes under perspective", () => {
  const TILT = { perspective: { horizontal: 30, vertical: 30 } };

  it.each([1e-160, 1e-200, 5e-324])("caps a zoom from size %d", (side) => {
    const cropper = createCropper({
      defaultValue: { aspect: 0.05, ...TILT },
      image: { height: 3024, width: 4032 },
    });

    cropper.setValue({
      ...cropper.getValue(),
      size: { height: side, width: side },
    });

    expect(cropper.getZoom()).toBeLessThanOrEqual(cropper.getMaxZoom() + 1e-9);
  });

  it("caps a zoom when one side alone would underflow the area", () => {
    const cropper = createCropper({
      defaultValue: { aspect: 0.05, ...TILT },
      image: { height: 3024, width: 4032 },
    });

    cropper.setValue({
      ...cropper.getValue(),
      size: { height: 1e-5, width: 5e-324 },
    });

    expect(cropper.getZoom()).toBeLessThanOrEqual(cropper.getMaxZoom() + 1e-9);
  });

  it("keeps the crop covered on a one pixel photo", () => {
    const cropper = createCropper({
      defaultValue: { aspect: 0.05, ...TILT },
      image: { height: 1, width: 1 },
    });

    cropper.setValue({
      ...cropper.getValue(),
      size: { height: 1e-200, width: 1e-200 },
    });

    expect(isCropCovered(cropState(cropper.getCropState()))).toBeTruthy();
  });
});

describe("a huge photo under perspective", () => {
  const TILT = { perspective: { horizontal: 30, vertical: 30 } };

  it.each([1e18, 1e20, 1e50, 1e150])(
    "stays sound on a photo side of %d",
    (side) => {
      const image = { height: side, width: 1 };
      const created = createCropper({ defaultValue: TILT, image });
      const swapped = createCropper({
        defaultValue: TILT,
        image: { height: 1000, width: 1000 },
      });

      swapped.setImage({ height: side, width: 1000 });

      expect(created.getState().pristine).toBeTruthy();

      for (const cropper of [created, swapped]) {
        expect(sound(cropper.getValue())).toBeTruthy();
        cropper.setZoom(2);
        cropper.reset();
        expect(sound(cropper.getValue())).toBeTruthy();
        expect(cropper.getState().pristine).toBeTruthy();
      }
    }
  );
});

describe("huge finite options", () => {
  it.each([1e155, 1e300, 1e308])(
    "keeps the state finite at focal length %d",
    (focalLength) => {
      const cropper = createCropper({ image: PHOTO });

      cropper.setOptions({ focalLength });

      cropper.setValue({
        ...cropper.getValue(),
        perspective: { horizontal: 10, vertical: 10 },
      });

      const { crop, perspective } = cropState(cropper.getCropState());

      expect(sound(cropper.getValue())).toBeTruthy();

      expect(
        [crop.width, crop.height, crop.x, crop.y, perspective.focal].every(
          Number.isFinite
        )
      ).toBeTruthy();
    }
  );
});

describe("the aspect it already has", () => {
  it.each([
    ["a ratio", 1],
    ["the photo's own", "original"],
  ] as const)(
    "setting %s again keeps the zoom and sends no commit",
    (_, aspect) => {
      const time = fakeClock();
      const commit = vi.fn<CropperEvents["commit"]>();
      const cropper = createCropper({
        clock: time.clock,
        defaultValue: { aspect },
        image: PHOTO,
        onValueCommit: commit,
      });

      cropper.setZoom(3);
      time.frames(2);
      commit.mockClear();
      const before = cropper.getValue();

      cropper.setAspect(aspect);
      time.frames(2);
      expect(cropper.getValue()).toBe(before);
      expect(commit).not.toHaveBeenCalled();
    }
  );

  it("a new aspect still fits the crop and commits once", () => {
    const time = fakeClock();
    const commit = vi.fn<CropperEvents["commit"]>();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { aspect: 1 },
      image: PHOTO,
      onValueCommit: commit,
    });

    cropper.setZoom(3);
    time.frames(2);
    commit.mockClear();
    cropper.setAspect(16 / 9);
    time.frames(2);
    expect(cropper.getZoom()).toBeCloseTo(1, 6);
    expect(commit).toHaveBeenCalledOnce();
  });
});

describe("minSize across quarter turns", () => {
  const MIN = { height: 630, width: 1200 };

  const floored = () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { aspect: 1200 / 630 },
      image: PHOTO,
      minSize: MIN,
    });

    cropper.setZoom(15);
    time.frames(2);

    return { cropper, time };
  };

  it("reads along the photo's sides, so a turn keeps the crop at the floor", () => {
    const { cropper } = floored();
    const zoom = cropper.getZoom();

    expect(cropper.getPixelCrop()?.width).toBe(1200);
    cropper.rotate90();
    expect(cropper.getZoom()).toBeCloseTo(zoom, 6);
    expect(cropper.getPixelCrop()?.width).toBe(630);
    expect(cropper.getPixelCrop()?.height).toBe(1200);
  });

  it("four turns restore the crop", () => {
    const { cropper } = floored();
    const before = cropper.getValue();

    for (let i = 0; i < 4; i += 1) {
      cropper.rotate90();
    }

    expect(valuesEqual(cropper.getValue(), before)).toBeTruthy();
  });

  it("zoom still works after a turn when the floor leaves room", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { quarterTurns: 1 },
      image: { height: 1000, width: 4000 },
      minSize: { height: 500, width: 3000 },
    });

    cropper.setZoom(1.2);
    expect(cropper.getZoom()).toBeCloseTo(1.2, 6);
  });

  it("the crop floor and getMinSize agree with the turn", () => {
    const { cropper } = floored();

    cropper.rotate90();
    expect(cropper.getMinSize()).toStrictEqual({ height: 1200, width: 630 });
  });
});

const zoomed = () => {
  const time = fakeClock();
  const cropper = createCropper({ clock: time.clock, image: PHOTO });
  const drop = cropper.retarget({ zoom: 2 });

  cropper.setZoom(2, { emit: false });

  return { cropper, drop, time };
};

describe("a reset target with a zoom", () => {
  it("reads as pristine at that zoom", () => {
    const { cropper } = zoomed();

    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("reset returns to that zoom", () => {
    const { cropper } = zoomed();

    cropper.setZoom(5);
    expect(cropper.getState().pristine).toBeFalsy();
    cropper.reset();
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("follows a new photo", () => {
    const { cropper } = zoomed();

    cropper.setImage({ height: 1000, width: 3000 });
    cropper.setZoom(2, { emit: false });
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("goes away with its target", () => {
    const { cropper, drop } = zoomed();

    drop();
    cropper.reset();
    expect(cropper.getZoom()).toBeCloseTo(1, 6);
  });
});
