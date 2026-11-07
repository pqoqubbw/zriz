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
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

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
  CropperInternals,
  CropperOptions,
} from "../src";
import type { QuarterTurns } from "../src/geometry";
import { noop, PHOTO, setup, stateOf } from "./cropper-fixture";
import type { Rig } from "./cropper-fixture";
import { fakeClock } from "./fake-clock";
import { isCropCovered, isPerspectiveValid } from "./geometry/oracles";

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
  const state = stateOf(cropper);

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

  expect(stateOf(cropper).perspective.focal).toBeGreaterThan(0);
};

const expectValid = (cropper: Cropper): void => {
  const value = cropper.getValue();
  const plan = cropper.getPixelCrop();

  expect(sound(value)).toBeTruthy();
  expect(cropper.getZoom()).toBeGreaterThanOrEqual(1 - 1e-9);
  expect(plan?.forward.every(Number.isFinite)).toBeTruthy();
  expect([plan?.width, plan?.height].every(Number.isFinite)).toBeTruthy();
  expect(isCropCovered(stateOf(cropper))).toBeTruthy();
};

const loose = (cropper: Cropper, given: unknown): void => {
  Reflect.apply(cropper.setValue, cropper, [given]);
};

const MIN_FLOOR = { height: 630, width: 1200 };

const floored = (): Rig => {
  const rig = setup({
    defaultValue: { aspect: 1200 / 630 },
    minSize: MIN_FLOOR,
  });

  rig.cropper.setZoom(15);
  rig.time.frames(2);

  return rig;
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

  it.each<[string, (cropper: Cropper) => void, (cropper: Cropper) => void]>([
    [
      "a value equal to the current one",
      noop,
      (cropper) => {
        cropper.setValue({ ...cropper.getValue() });
        cropper.setValue({ rotation: 0 });
      },
    ],
    [
      "the same photo again",
      (cropper) => {
        cropper.setValue({ rotation: 5 });
      },
      (cropper) => {
        cropper.setImage({ ...PHOTO });
      },
    ],
    [
      "a photo of the same size under a crop on a limit",
      (cropper) => {
        cropper.setZoom(1.5);
        cropper.panBy(2, 0);
      },
      (cropper) => {
        cropper.setImage({ ...PHOTO });
      },
    ],
    [
      "a later photo of the same shape",
      noop,
      (cropper) => {
        cropper.setImage({ height: 1500, width: 2000 });
      },
    ],
  ])("stays silent on %s", (_, prepare, write) => {
    const { change, commit, cropper, time } = setup();

    prepare(cropper);
    time.frames(3);
    change.mockClear();
    commit.mockClear();
    const before = cropper.getValue();

    write(cropper);
    time.frames(3);
    expect(cropper.getValue()).toBe(before);
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
    const starts = vi.fn<() => void>();

    cropper.on("gesturestart", starts);
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
    expect(commit.mock.calls.map(([, d]) => d.reason)).toStrictEqual(["pan"]);
    cropper.begin("pan");
    cropper.setRotation(3);
    time.frame();
    cropper.begin("pinch");
    cropper.setRotation(6);
    time.frame();
    cropper.end();
    time.frame();

    expect([starts.mock.calls.length, commit.mock.calls.length]).toStrictEqual([
      2, 2,
    ]);
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

  it.each<[string, (cropper: Cropper) => void, number, number, number]>([
    [
      "a controlled value written twice",
      (cropper) => {
        const next = { ...cropper.getValue(), rotation: 8 };

        cropper.setValue(next, { emit: false, reason: "controlled" });
        cropper.setValue(next, { emit: false, reason: "controlled" });
      },
      0,
      0,
      8,
    ],
    [
      "a silent write of the value a change is waiting with",
      (cropper) => {
        cropper.setRotation(5);
        cropper.setRotation(5, { emit: false });
      },
      0,
      0,
      5,
    ],
    [
      "a controlled echo of a waiting write",
      (cropper) => {
        cropper.setRotation(5);

        cropper.setValue(cropper.getValue(), {
          emit: false,
          reason: "controlled",
        });
      },
      1,
      1,
      5,
    ],
    [
      "a silent echo inside the change listener",
      (cropper) => {
        cropper.on("change", (value) => {
          cropper.setValue(value, { emit: false });
        });

        cropper.setRotation(5);
      },
      1,
      1,
      5,
    ],
  ])(
    "echoes nothing back after %s",
    (_, write, changes, commits, committed) => {
      const { change, commit, cropper, time } = setup();
      const before = cropper.getValue();

      write(cropper);
      time.frames(3);
      expect(change).toHaveBeenCalledTimes(changes);
      expect(commit).toHaveBeenCalledTimes(commits);

      expect(
        commit.mock.calls.every(([, details]) => details.previous === before)
      ).toBeTruthy();

      expect(cropper.getState().committed.rotation).toBe(committed);
    }
  );

  it("stays pristine on a refitted start value and when it is written back", () => {
    const { cropper, time } = setup({
      defaultValue: { aspect: 1, rotation: 60 },
      image: { height: 3024, width: 4032 },
    });

    time.frames(2);
    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setValue(cropper.getValue());
    time.frames(2);
    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setRotation(10);
    time.frames(2);
    expect(cropper.getState().pristine).toBeFalsy();
    cropper.reset();
    time.frames(2);
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("stores a value before a photo, ignores NaN, reports reasons and fixes it on arrival", () => {
    const { cropper, time } = setup({ image: null });
    const reasons: string[] = [];

    cropper.on("change", (_, details) => {
      reasons.push(details.reason);
    });

    const rotations: number[] = [];

    cropper.setValue({ rotation: 12 });
    time.frames(2);
    rotations.push(cropper.getValue().rotation);
    cropper.reset();
    time.frames(2);
    rotations.push(cropper.getValue().rotation);
    expect(reasons).toStrictEqual(["imperative", "reset"]);
    cropper.setValue({ rotation: 60 });
    rotations.push(cropper.getValue().rotation);
    cropper.setValue({ rotation: Number.NaN });
    rotations.push(cropper.getValue().rotation);
    cropper.setImage(PHOTO);
    rotations.push(cropper.getValue().rotation);
    expect(rotations).toStrictEqual([12, 0, 60, 60, 45]);
    expect(isCropCovered(stateOf(cropper))).toBeTruthy();
  });

  it("notifies state subscribers when any one snapshot field changes and never without a change", () => {
    const { cropper, time } = setup({ image: { height: 3024, width: 4032 } });

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

  it.each<[string, () => Rig]>([
    [
      "a straightened crop",
      () => {
        const rig = setup();

        rig.cropper.setValue({
          center: { x: 0.4, y: 0.6 },
          rotation: 7,
          size: { height: 0.4, width: 0.3 },
        });

        return rig;
      },
    ],
    [
      "a ratio whose side rounds to the next step",
      () => setup({ defaultValue: { aspect: 6.650816071338371 } }),
    ],
    ["a crop held at minSize", floored],
  ])("restores %s after four quarter turns and two flips", (_, make) => {
    const { cropper } = make();
    const before = cropper.getValue();
    const { pristine } = cropper.getState();

    for (let i = 0; i < 4; i += 1) {
      cropper.rotate90();
    }

    cropper.flip("x");
    cropper.flip("x");
    expect(valuesEqual(cropper.getValue(), before)).toBeTruthy();
    expect(cropper.getState().pristine).toBe(pristine);
  });

  it("holds a fixed aspect through every action", () => {
    const { cropper } = setup({ defaultValue: { aspect: 4 / 5 } });

    cropper.setRotation(-20);
    cropper.setZoom(3);
    cropper.panBy(0.3, -0.2);
    const { width, height } = stateOf(cropper).crop;

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
          const { cropper } = setup({
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

            const state = stateOf(cropper);

            expect(isCropCovered(state, 1e-6)).toBeTruthy();
            expect(Math.abs(state.angle)).toBeLessThanOrEqual(45);
            expect(cropper.getZoom()).toBeLessThanOrEqual(15 * (1 + 1e-6));
            expect(cropper.getZoom()).toBeGreaterThanOrEqual(1 - 1e-5);
            const value: CropValue = cropper.getValue();

            expect(parse(serialize(value))).toStrictEqual(value);
          }
        }
      ),
      {
        examples: [
          [
            { height: 61, width: 13 },
            [
              { kind: "rotate", n: 45 },
              { kind: "zoom", n: 0.5 },
              { kind: "zoom", n: 3.1967245081967204 },
              { kind: "pan", n: [0, -0.6599663713976182] },
              { kind: "rotate", n: 0 },
            ],
          ],
        ],
      }
    );
  });
});

const isCollector = (value: unknown): value is () => void =>
  typeof value === "function";

describe("what the cropper holds on to", () => {
  it("holds neither the image object nor the last event", async () => {
    const given = { height: 30, preview: {}, width: 40 };
    const small = setup({ image: given });

    expect(small.cropper.getCropState()?.image).toStrictEqual({
      height: 30,
      width: 40,
    });

    small.cropper.setImage(given);

    expect(small.cropper.getCropState()?.image).toStrictEqual({
      height: 30,
      width: 40,
    });

    setFlagsFromString("--expose-gc");
    const collect: unknown = runInNewContext("gc");

    if (!isCollector(collect)) {
      throw new TypeError("no gc");
    }

    const { clock, frames } = fakeClock();
    const cropper = createCropper({ clock, image: PHOTO });

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
  it.each<[string, (cropper: Cropper) => void]>([
    [
      "an angle of 1e-13",
      (cropper) => {
        cropper.setRotation(10);
        cropper.setRotation(1e-13);
      },
    ],
    [
      "angles that sum to almost zero",
      (cropper) => {
        let angle = 0;

        for (const step of [0.1, 0.1, 0.1, -0.1, -0.1, -0.1]) {
          angle += step;
          cropper.setRotation(angle);
        }
      },
    ],
    [
      "a tilt of 1e-13",
      (cropper) => {
        cropper.setValue({ perspective: { horizontal: 0, vertical: 10 } });

        cropper.setValue({
          perspective: { horizontal: 1e-13, vertical: 1e-13 },
        });
      },
    ],
  ])("reads %s as level and flat", (_, write) => {
    const { cropper } = setup();

    write(cropper);
    expect(cropper.getValue().rotation).toBe(0);
    expect(cropper.getCropState()?.angle).toBe(0);
    expect(cropper.getPixelCrop()?.homography).toBeNull();
    expect(cropper.getPixelCrop()?.pixelRect).not.toBeNull();
  });

  it.each([
    [
      { height: 10, width: 10.5 },
      { height: 10, width: 11 },
    ],
    [
      { height: 0.4, width: 0.4 },
      { height: 1, width: 1 },
    ],
  ])("reads a photo of %o as whole pixels %o", (image, whole) => {
    const { cropper } = setup({ image });

    expect(cropper.getCropState()?.image).toStrictEqual(whole);

    expect(cropper.getPixelCrop()?.pixelRect).toStrictEqual({
      left: 0,
      top: 0,
      ...whole,
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

  it.each<
    [
      string,
      (cropper: Cropper, thrower: () => boolean, time: Rig["time"]) => void,
    ]
  >([
    [
      "change listener",
      (cropper, thrower) => {
        cropper.on("change", () => {
          thrower();
        });
      },
    ],
    [
      "commit listener",
      (cropper, thrower) => {
        cropper.on("commit", () => {
          thrower();
        });
      },
    ],
    [
      "task",
      (cropper, thrower, time) => {
        cropper.run(() => thrower());
        time.frame();
      },
    ],
    [
      "gestureend listener",
      (cropper, thrower) => {
        cropper.on("gestureend", () => {
          thrower();
        });
      },
    ],
    [
      "subscriber",
      (cropper, thrower) => {
        cropper.subscribe(() => {
          thrower();
        });
      },
    ],
  ])("keeps frames, commits and settle going past a throwing %s", (_, add) => {
    const errors = reported();
    const { commit, cropper, time } = setup();
    const thrower = vi.fn<() => boolean>().mockImplementationOnce(boom);
    const later = vi.fn<() => void>();
    const frame = vi.fn<() => void>();
    const settle = vi.fn<() => void>();
    const next = vi.fn<() => void>();

    add(cropper, thrower, time);
    cropper.on("change", later);
    cropper.on("frame", frame);
    cropper.on("settle", settle);
    cropper.subscribe(next);
    cropper.begin("pan");
    cropper.setRotation(5);
    cropper.end();
    cropper.run(() => false);
    time.frames(3);
    expect(errors).toHaveLength(1);

    expect({
      commits: commit.mock.calls.length,
      frame: frame.mock.calls.length > 0,
      later: later.mock.calls.length > 0,
      next: next.mock.calls.length > 0,
      settles: settle.mock.calls.length,
      thrown: thrower.mock.calls.length > 0,
    }).toStrictEqual({
      commits: 1,
      frame: true,
      later: true,
      next: true,
      settles: 1,
      thrown: true,
    });

    expect(cropper.getValue().rotation).toBe(5);

    expect(cropper.getState()).toMatchObject({
      interacting: null,
      settling: false,
    });
  });

  it("runs listeners on a copy of the list while they add and remove themselves", () => {
    const { cropper } = setup();
    const again = vi.fn<() => void>();
    const resubscribed = vi.fn<() => void>();
    const removed = vi.fn<() => void>();
    const added = vi.fn<() => void>();
    let offStop = noop;
    let offSubscribe = noop;
    let offRemoved = noop;

    const rearm = (): void => {
      again();
      offStop();
      offStop = cropper.on("stop", rearm);
    };

    const resubscribe = (): void => {
      resubscribed();
      offSubscribe();
      offSubscribe = cropper.subscribe(resubscribe);
    };

    offStop = cropper.on("stop", rearm);
    offSubscribe = cropper.subscribe(resubscribe);
    cropper.stop();
    cropper.stop();
    expect(again).toHaveBeenCalledTimes(2);
    cropper.flip();
    expect(resubscribed).toHaveBeenCalledOnce();
    offStop();

    cropper.on("stop", () => {
      offRemoved();
      cropper.on("stop", added);
    });

    offRemoved = cropper.on("stop", removed);
    cropper.stop();
    expect(removed).not.toHaveBeenCalled();
    expect(added).not.toHaveBeenCalled();
  });
});

describe("destroy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs each started plugin's destroy once, past a throwing one, with its this", () => {
    const errors = reported();
    const again = vi.fn<() => void>();
    const next = {
      destroy(this: { seen?: boolean }) {
        this.seen = true;
      },
      init: noop,
      name: "next",
      seen: false,
    };
    const second = {
      destroy: vi.fn<() => void>(),
      init: vi.fn<() => void>(),
      name: "second",
    };
    const { change, cropper, time } = setup({
      plugins: [
        {
          destroy() {
            throw new Error("plugin failed");
          },
          init: noop,
          name: "bad",
        },
        {
          destroy() {
            again();
            cropper.destroy();
          },
          init: noop,
          name: "again",
        },
        next,
      ],
    });
    const late: CropperOptions = { plugins: [second] };
    const fired = vi.fn<() => void>(() => {
      cropper.destroy();
    });

    cropper.setOptions(late);
    cropper.on("destroy", fired);
    cropper.destroy();
    vi.unstubAllGlobals();
    cropper.setRotation(10);
    time.frames(2);

    expect({
      again: again.mock.calls.length,
      changes: change.mock.calls.length,
      fired: fired.mock.calls.length,
      late: second.init.mock.calls.length + second.destroy.mock.calls.length,
      seen: next.seen,
    }).toStrictEqual({ again: 1, changes: 0, fired: 1, late: 0, seen: true });

    expect(errors).toHaveLength(1);
  });

  it("ends a running gesture without gestureend, and nothing after it has effect", () => {
    const { commit, cropper, time } = setup();
    const heard = vi.fn<() => void>();

    cropper.on("stop", heard);
    cropper.on("gestureend", heard);

    cropper.on("destroy", () => {
      cropper.stop();
    });

    cropper.begin("pan");
    cropper.setRotation(5);
    const { interacting } = cropper.getState();

    cropper.destroy();

    expect([interacting, cropper.getState().interacting]).toStrictEqual([
      "pan",
      null,
    ]);

    const listener = vi.fn<() => void>();
    const offs = [
      cropper.on("stop", listener),
      cropper.on("stop", listener),
      cropper.subscribe(listener),
      cropper.subscribe(listener),
    ];

    expect([new Set(offs).size, typeof offs[0]]).toStrictEqual([1, "function"]);
    const task = vi.fn<() => boolean>(() => true);

    cropper.run(task)();
    cropper.setOptions({ disabled: true, maxZoom: 2 });
    cropper.stop();
    cropper.flip();
    cropper.on("commit", vi.fn<() => void>())();
    cropper.subscribe(vi.fn<() => void>())();
    time.frames(3);

    expect(
      [task, listener, heard, commit].map((spy) => spy.mock.calls.length)
    ).toStrictEqual([0, 0, 0, 0]);

    expect({
      ...cropper.getState(),
      maxZoom: cropper.getMaxZoom(),
    }).toMatchObject({
      disabled: false,
      maxZoom: 15,
      settling: false,
    });
  });

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

describe("event order", () => {
  it("shows commit, gesture and stop listeners a fresh snapshot", () => {
    const { cropper, time } = setup();
    const committed: number[] = [];
    const seen: unknown[] = [];

    cropper.on("commit", () => {
      committed.push(cropper.getState().committed.rotation);
    });

    cropper.setRotation(5);
    time.frame();
    cropper.setRotation(9);
    time.frame();
    expect(committed).toStrictEqual([5, 9]);

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

  it("keeps a silent write made inside a change listener, cancels back to it and reports the next move from it", () => {
    const { change, commit, cropper, time } = setup();
    const offClamp = cropper.on("change", () => {
      offClamp();
      cropper.setRotation(10, { emit: false });
    });

    cropper.setRotation(20);
    time.frame();
    expect(cropper.getValue().rotation).toBe(10);
    const offCancel = cropper.on("change", (_, details) => {
      details.cancel();
    });

    cropper.setRotation(30);
    time.frames(2);

    expect([
      cropper.getValue().rotation,
      cropper.getState().committed.rotation,
      commit.mock.calls.length,
    ]).toStrictEqual([10, 10, 0]);

    offCancel();
    change.mockClear();
    cropper.setRotation(20);
    time.frame();
    expect(change.mock.calls[0]?.[0].rotation).toBe(20);

    expect(change.mock.calls[0]?.[1]).toMatchObject({
      changed: ["rotation"],
      previous: { rotation: 10 },
    });
  });

  it.each<[string, (cropper: Cropper, time: Rig["time"]) => void]>([
    ...(["change", "frame"] as const).map(
      (type): [string, (cropper: Cropper, time: Rig["time"]) => void] => [
        `a ${type} listener writes on the last task frame`,
        (cropper, time) => {
          const off = cropper.on(type, () => {
            off();
            cropper.setRotation(5);
          });

          cropper.setRotation(3);
          cropper.run(() => false);
          time.frames(2);
        },
      ]
    ),
    ...(
      [
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
      ] as [string, (cropper: Cropper) => void][]
    ).map(
      ([name, write]): [
        string,
        (cropper: Cropper, time: Rig["time"]) => void,
      ] => [
        `${name} is written after the cancel of the last task`,
        (cropper, time) => {
          const stop = cropper.run(() => true);

          time.frames(2);
          stop();
          write(cropper);
          time.frames(5);
        },
      ]
    ),
  ])("fires settle once when %s", (_, scenario) => {
    const { cropper, time } = setup();
    const settle = vi.fn<CropperEvents["settle"]>();

    cropper.on("settle", settle);
    scenario(cropper, time);
    expect(cropper.getState().settling).toBeFalsy();
    expect(settle).toHaveBeenCalledOnce();
  });

  it.each<
    [
      string,
      CropperOptions,
      (cropper: Cropper) => void,
      (c: Cropper) => void,
      string[],
    ]
  >([
    [
      "a zoom after a silent write inside a change listener",
      {},
      (cropper) => {
        const off = cropper.on("change", () => {
          off();
          cropper.setRotation(10, { emit: false });
        });

        cropper.setRotation(20);
      },
      (cropper) => {
        cropper.setZoom(1.5);
      },
      ["size"],
    ],
    [
      "a flip after a size with long decimals",
      { image: { height: 1000, width: 1000 } },
      (cropper) => {
        cropper.setValue({ size: { height: 0.3, width: 0.19416446166578682 } });
      },
      (cropper) => {
        cropper.flip();
      },
      ["mirrored"],
    ],
    [
      "a zoom after an angle with long decimals",
      {},
      (cropper) => {
        cropper.setValue({ rotation: 1.1234567890123457 });
      },
      (cropper) => {
        cropper.setZoom(2);
      },
      ["size"],
    ],
  ])("lists only what moved on %s", (_, options, prepare, write, moved) => {
    const { change, cropper, time } = setup(options);

    prepare(cropper);
    time.frame();
    change.mockClear();
    write(cropper);
    time.frame();
    const [value, details] = change.mock.calls[0] ?? [];

    const kept = (Object.keys(defaultValue) as (keyof CropValue)[]).filter(
      (key) => !moved.includes(key)
    );

    expect(details?.changed).toStrictEqual(moved);

    expect(kept.map((key) => value?.[key])).toStrictEqual(
      kept.map((key) => details?.previous[key])
    );
  });

  it.each<
    [string, CropperOptions, Partial<CropValue>, Partial<CropValue>, string]
  >([
    [
      "a centre, along x",
      {
        value: {
          ...defaultValue,
          center: { x: 0.4, y: 0.4 },
          size: { height: 0.5, width: 0.5 },
        },
      },
      { center: { x: 0.4 + 1e-11, y: 0.4 + 2e-11 } },
      { center: { x: 0.4 + 1e-10, y: 0.4 } },
      "center",
    ],
    [
      "a centre, along y",
      {
        value: {
          ...defaultValue,
          center: { x: 0.4, y: 0.4 },
          size: { height: 0.5, width: 0.5 },
        },
      },
      { center: { x: 0.4 + 1e-11, y: 0.4 + 2e-11 } },
      { center: { x: 0.4, y: 0.4 + 1e-10 } },
      "center",
    ],
    [
      "a centre on a very long photo",
      {
        image: { height: 3, width: 1_000_000 },
        value: {
          ...defaultValue,
          center: { x: 0.4, y: 0.5 },
          size: { height: 1, width: 0.5 },
        },
      },
      {},
      { center: { x: 0.4 + 1e-9, y: 0.5 } },
      "center",
    ],
    [
      "ten pixels of width on a very long photo",
      {
        image: { height: 3, width: 1_000_000 },
        value: { ...defaultValue, size: { height: 1, width: 0.5 } },
      },
      {},
      { size: { height: 1, width: 0.5 + 1e-5 } },
      "size",
    ],
  ])(
    "holds %s below a pixel's rounding and reports it above",
    (_, options, below, above, field) => {
      const { change, cropper, time } = setup(options);

      time.frame();
      const before = cropper.getValue();

      cropper.setValue(below);
      time.frame();
      expect(change).not.toHaveBeenCalled();
      expect(cropper.getValue()).toStrictEqual(before);
      cropper.setValue(above);
      time.frame();
      expect(change.mock.calls[0]?.[1].changed).toStrictEqual([field]);
    }
  );

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
    expect(stateOf(cropper).image.height).toBe(2000);
    expect(commit).toHaveBeenCalledOnce();
  });

  it.each<
    [
      string,
      number,
      (rig: Rig) => void,
      { height: number; width: number },
      number,
      boolean,
    ]
  >([
    [
      "a maxZoom lowered after the save",
      15,
      ({ cropper, time }) => {
        cropper.on("change", (_, details) => {
          details.cancel();
        });

        cropper.setOptions({ maxZoom: 2 });
        time.frames(2);
      },
      { height: 1500, width: 2000 },
      1,
      false,
    ],
    [
      "a minSize raised during a gesture",
      10,
      ({ cropper, time }) => {
        cropper.begin("pan");
        cropper.setOptions({ minSize: { height: 1500, width: 2000 } });
        time.frame();
        cropper.cancel();
        time.frames(2);
      },
      { height: 1500, width: 2000 },
      1,
      false,
    ],
    [
      "limits that did not change",
      3,
      ({ cropper, time }) => {
        cropper.begin("pan");
        cropper.panBy(0.05, 0);
        time.frame();
        cropper.cancel();
      },
      { height: 1000, width: 1334 },
      0,
      true,
    ],
  ])(
    "cancels into the current limits after %s",
    (_, zoom, scenario, size, commits, same) => {
      const rig = setup();

      rig.cropper.setZoom(zoom);
      rig.time.frames(2);
      rig.commit.mockClear();
      const before = rig.cropper.getValue();

      scenario(rig);
      expect(pixels(rig.cropper)).toStrictEqual(size);
      expect(rig.commit).toHaveBeenCalledTimes(commits);
      expect(rig.cropper.getValue() === before).toBe(same);
    }
  );

  it("takes a new lens on the next write and keeps it through a canceled change", () => {
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

    const offCancel = cropper.on("change", (_, details) => {
      details.cancel();
    });

    cropper.setRotation(5);
    time.frame();
    expect(lens()).toBeCloseTo(wanted, 6);
    offCancel();
    cropper.setOptions({ focalLength: 26 });
    cropper.reset();
    expect(lens()).toBeCloseTo(before ?? 0, 6);
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
  ])(
    "ignores %s, leaves the crop where it was and keeps working",
    (_, write) => {
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
      cropper.setRotation(5);
      cropper.setZoom(2);
      cropper.panBy(0.01, 0);
      expectValid(cropper);
      expect(cropper.getValue().rotation).toBe(5);
      expect(serialize(cropper.getValue())).not.toContain("null");
    }
  );

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

  it.each<[string, CropperOptions, (cropper: Cropper) => void, number, number]>(
    [
      [
        "setRotation(Infinity)",
        { value: undefined },
        (c) => {
          c.setRotation(huge);
        },
        45,
        0.5,
      ],
      [
        "setRotation(-Infinity)",
        { value: undefined },
        (c) => {
          c.setRotation(-huge);
        },
        -45,
        0.5,
      ],
      [
        "a rotation of 90 through setValue",
        {},
        (c) => {
          c.setValue({ rotation: 90 });
        },
        45,
        0.7,
      ],
      [
        "a defaultValue rotation of 225 on reset",
        {
          defaultValue: {
            center: { x: 0.7, y: 0.5 },
            rotation: 225,
            size: { height: 0.2, width: 0.2 },
          },
          value: undefined,
        },
        (c) => {
          c.reset();
        },
        45,
        0.7,
      ],
    ]
  )(
    "clamps %s to the limit and holds the centre",
    (_, options, write, rotation, x) => {
      const { cropper } = setup({
        image: { height: 1000, width: 1000 },
        value: {
          ...defaultValue,
          center: { x: 0.7, y: 0.5 },
          size: { height: 0.2, width: 0.2 },
        },
        ...options,
      });

      write(cropper);
      expect(cropper.getValue().rotation).toBe(rotation);
      expect(cropper.getValue().center.x).toBeCloseTo(x, 9);
      expect(cropper.getValue().center.y).toBeCloseTo(0.5, 9);
    }
  );

  it.each<[string, CropperOptions]>([
    ["defaultValue rotation", { defaultValue: { rotation: bad } }],
    ["defaultValue size", { defaultValue: { size: { height: 0, width: 0 } } }],
    [
      "defaultValue negative size",
      { defaultValue: { size: { height: -1, width: -1 } } },
    ],
    ["defaultValue center", { defaultValue: { center: { x: huge, y: bad } } }],
    ["defaultValue aspect", { defaultValue: { aspect: bad } }],
    [
      "defaultValue huge center",
      { defaultValue: { center: { x: 1e308, y: 1e151 } } },
    ],
    [
      "value",
      {
        value: {
          ...defaultValue,
          rotation: bad,
          size: { height: 0, width: 1 },
        },
      },
    ],
  ])("starts valid and resets valid from a bad %s", (_, options) => {
    const { cropper } = setup(options);

    expectValid(cropper);
    expect(cropper.getValue().rotation).toBe(0);
    cropper.reset();
    expectValid(cropper);
    expect(cropper.getState().pristine).toBeTruthy();
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
    const { cropper: fresh } = setup({ defaultValue: { [key]: undefined } });

    expect(fresh.getValue()).toStrictEqual(defaultValue);
  });

  it.each<[number, CropValue["aspect"]]>([
    [0, "free"],
    [-1.5, "free"],
    [huge, "free"],
    [-huge, "free"],
    [bad, "free"],
    [1e14, "free"],
    [1e-14, "free"],
    [1e200, "free"],
    [1.5, 1.5],
    [1e-3, 1e-3],
    [1e3, 1e3],
    [1e6, 1e6],
    [1e-6, 1e-6],
  ])("reads an aspect of %s as %s on every path", (ratio, aspect) => {
    const { cropper } = setup();

    cropper.setAspect(ratio);
    expect(cropper.getValue().aspect).toBe(aspect);
    expectValid(cropper);
    cropper.setAspect(1);
    cropper.setValue({ aspect: ratio });
    expect(cropper.getValue().aspect).toBe(aspect);
    expectValid(cropper);
    const { cropper: fresh } = setup({ defaultValue: { aspect: ratio } });

    expect(fresh.getValue().aspect).toBe(aspect);
    expectValid(fresh);
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
    [huge, huge],
  ])("reads a maxZoom of %s as %s", (maxZoom, cap) => {
    const { cropper } = setup({ maxZoom });

    expect(cropper.getMaxZoom()).toBe(cap);
    cropper.setZoom(30);
    expect(cropper.getZoom()).toBeCloseTo(Math.min(cap, 30), 6);
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

const sized = (height: number, width: number) => (cropper: Cropper) => {
  cropper.setValue({ ...cropper.getValue(), size: { height, width } });
};

const zoomAndReset = (cropper: Cropper): void => {
  cropper.setZoom(2);
  cropper.reset();
};

describe("extreme sizes", () => {
  const TILT = { perspective: { horizontal: 30, vertical: 30 } };
  const THIN = { defaultValue: { aspect: 0.05, ...TILT } };
  const CAMERA = { height: 3024, width: 4032 };

  it.each<[string, CropperOptions, (cropper: Cropper) => void, boolean]>([
    [
      "a thin crop on a photo 1e12 long",
      { defaultValue: { aspect: 0.2 }, image: { height: 1, width: 1e12 } },
      (cropper) => {
        cropper.setValue(cropper.getValue());
      },
      true,
    ],
    ...[1e-160, 1e-200, 5e-324].map(
      (side): [string, CropperOptions, (cropper: Cropper) => void, boolean] => [
        `a tilted size of ${side}`,
        { ...THIN, image: CAMERA },
        sized(side, side),
        false,
      ]
    ),
    [
      "one tilted side alone underflowing",
      { ...THIN, image: CAMERA },
      sized(1e-5, 5e-324),
      false,
    ],
    [
      "a tilted one pixel photo",
      { ...THIN, image: { height: 1, width: 1 } },
      sized(1e-200, 1e-200),
      true,
    ],
    ...[1e18, 1e20, 1e50, 1e150].flatMap(
      (
        side
      ): [string, CropperOptions, (cropper: Cropper) => void, boolean][] => [
        [
          `a tilted photo side of ${side}`,
          { defaultValue: TILT, image: { height: side, width: 1 } },
          zoomAndReset,
          true,
        ],
        [
          `a tilted photo swapped to a side of ${side}`,
          { defaultValue: TILT, image: { height: 1000, width: 1000 } },
          (cropper) => {
            cropper.setImage({ height: side, width: 1000 });
            zoomAndReset(cropper);
          },
          true,
        ],
      ]
    ),
    ...[1e155, 1e300, 1e308].map(
      (
        focalLength
      ): [string, CropperOptions, (cropper: Cropper) => void, boolean] => [
        `a focal length of ${focalLength}`,
        {},
        (cropper) => {
          cropper.setOptions({ focalLength });

          cropper.setValue({
            ...cropper.getValue(),
            perspective: { horizontal: 10, vertical: 10 },
          });
        },
        false,
      ]
    ),
  ])("stays valid with %s", (_, options, write, pristine) => {
    const { cropper } = setup(options);

    write(cropper);
    const { crop, perspective } = stateOf(cropper);

    expect(sound(cropper.getValue())).toBeTruthy();
    expect(cropper.getZoom()).toBeLessThanOrEqual(cropper.getMaxZoom() + 1e-9);
    expect(isCropCovered(stateOf(cropper))).toBeTruthy();

    expect(
      [crop.width, crop.height, crop.x, crop.y, perspective.focal].every(
        Number.isFinite
      )
    ).toBeTruthy();

    expect(cropper.getState().pristine).toBe(pristine);
  });
});

describe("large photos", () => {
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
              stateOf(cropper),
              Math.max(1e-9, 2e-8 / Math.max(width, height))
            )
          ).toBeTruthy();
        }
      ),
      {
        examples: [
          [
            {
              height: 65_535,
              horizontal: 0,
              rotation: 1.3335e-11,
              turns: 0,
              vertical: 0,
              width: 32_767,
              x: 0,
              y: 0,
            },
          ],
          [
            {
              height: 1_000_000,
              horizontal: 0,
              rotation: 1e-12,
              turns: 0,
              vertical: 0,
              width: 300_000,
              x: 0,
              y: 0,
            },
          ],
          [
            {
              height: 1e8,
              horizontal: 0,
              rotation: 0,
              turns: 0,
              vertical: -30,
              width: 1e8,
              x: 0,
              y: 0,
            },
          ],
          [
            {
              height: 1e8,
              horizontal: 0,
              rotation: 44.999,
              turns: 1,
              vertical: 0,
              width: 2,
              x: 0,
              y: 0,
            },
          ],
          [
            {
              height: 75_274_033,
              horizontal: -17.6,
              rotation: 0,
              turns: 0,
              vertical: 30,
              width: 14,
              x: 0,
              y: 0,
            },
          ],
        ],
      }
    );
  });
});

describe("short lens", () => {
  it.each([
    [13, false],
    [6, false],
    [0.5, false],
    [26, true],
  ])(
    "keeps a %s mm crop on the photo at full tilt, the lens as given: %s",
    (mm, given) => {
      const { cropper } = setup({
        defaultValue: { perspective: { horizontal: 30, vertical: 30 } },
        focalLength: mm,
      });
      const state = stateOf(cropper);

      expect(isCropCovered(state)).toBeTruthy();
      const { center } = cropper.getValue();

      expect(Math.abs(center.x - 0.5)).toBeLessThan(0.5);
      expect(Math.abs(center.y - 0.5)).toBeLessThan(0.5);

      expect(
        isPerspectiveValid(state.image, state.perspective, 0.05)
      ).toBeTruthy();

      expect(Math.abs(state.perspective.focal - (mm / 36) * 4000) < 1e-6).toBe(
        given
      );
    }
  );
});

describe("setCropState", () => {
  it("keeps the store's aspect, photo and lens", () => {
    const { cropper } = setup({
      defaultValue: { perspective: { horizontal: 0, vertical: 20 } },
    });
    const state = stateOf(cropper);

    cropper.setCropState({
      ...state,
      aspect: 2,
      image: { height: 10, width: 10 },
      perspective: { ...state.perspective, focal: 100 },
    });

    expect(stateOf(cropper)).toMatchObject({
      aspect: null,
      image: PHOTO,
      perspective: { focal: state.perspective.focal },
    });

    cropper.setAspect(1);
    const locked = stateOf(cropper);

    cropper.setCropState({
      ...locked,
      aspect: null,
      crop: { ...locked.crop, height: 200, width: 1000 },
    });

    const after = stateOf(cropper);

    expect(after.aspect).toBe(1);
    expect(after.crop.width).toBeCloseTo(after.crop.height, 6);
    cropper.setValue(cropper.getValue());
    expect(cropper.getCropState()?.crop.width).toBeCloseTo(after.crop.width, 6);
  });

  it.each<[string, Record<string, unknown>, boolean, number]>([
    ["a string flip", { flip: "x" }, false, 0],
    ["a number flip", { flip: 1 }, false, 0],
    ["no flip", { flip: undefined }, false, 0],
    ["five turns", { turns: 5 }, false, 1],
  ])("cleans %s into the value", (_, loosened, mirrored, turns) => {
    const { cropper } = setup();

    Reflect.apply(cropper.setCropState, cropper, [
      { ...stateOf(cropper), ...loosened },
    ]);

    expect(cropper.getValue().mirrored).toBe(mirrored);
    expect(cropper.getValue().quarterTurns).toBe(turns);
    expect(stateOf(cropper).turns).toBe(turns);
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

  it("brings a stored crop on a limit back exactly, through serialize and through setValue", () => {
    const { cropper, time } = onTheEdge();
    const stored = cropper.getValue();
    const saved = parse(serialize(stored)) ?? defaultValue;

    expect(setup({ value: saved }).cropper.getValue()).toStrictEqual(saved);
    expect(saved).not.toBe(defaultValue);
    cropper.setRotation(3);
    time.frames(3);
    cropper.setValue(stored, { reason: "history" });
    time.frames(3);
    expect(cropper.getValue()).toStrictEqual(stored);
  });

  it("stays quiet on any crop written back, on any photo shape", () => {
    fcAssert(
      property(
        record({
          angle: double({ max: 45, min: -45, noNaN: true }),
          aspect: constantFrom<CropValue["aspect"]>("free", 16 / 9),
          image: constantFrom(
            PHOTO,
            { height: 30, width: 40 },
            { height: 100, width: 20_000 },
            { height: 3, width: 1_000_000 },
            { height: 3024, width: 4032 }
          ),
          pan: double({ max: 3, min: -3, noNaN: true }),
          zoom: double({ max: 15, min: 1, noNaN: true }),
        }),
        ({ angle, aspect, image, pan, zoom }) => {
          const { change, commit, cropper, time } = setup({
            image,
            value: { ...defaultValue, aspect },
          });

          cropper.setRotation(angle);
          cropper.setZoom(zoom);
          cropper.panBy(pan, pan / 2);
          time.frames(2);
          change.mockClear();
          commit.mockClear();
          const held = cropper.getValue();

          cropper.setValue(cropper.getValue());
          time.frames(2);
          expect(change).not.toHaveBeenCalled();
          expect(commit).not.toHaveBeenCalled();
          expect(cropper.getValue().size).toStrictEqual(held.size);
        }
      ),
      {
        examples: [
          [
            {
              angle: 0,
              aspect: 16 / 9,
              image: { height: 3, width: 1_000_000 },
              pan: 0,
              zoom: 1,
            },
          ],
          [
            {
              angle: 7.5e-12,
              aspect: "free",
              image: { height: 100, width: 20_000 },
              pan: -0.8531595559399789,
              zoom: 6.8102518945089665,
            },
          ],
          [
            {
              angle: 1.2095e-9,
              aspect: "free",
              image: { height: 100, width: 20_000 },
              pan: 0.4666666666875,
              zoom: 14.999999945559717,
            },
          ],
          [
            {
              angle: -0.000018614188500000004,
              aspect: "free",
              image: { height: 100, width: 20_000 },
              pan: 0.000032483463526374626,
              zoom: 1,
            },
          ],
          [
            {
              angle: 0.0004974819465,
              aspect: "free",
              image: { height: 3000, width: 4000 },
              pan: -0.000002532001256004277,
              zoom: 1,
            },
          ],
          [
            {
              angle: -0.08214960909350001,
              aspect: "free",
              image: { height: 30, width: 40 },
              pan: -3.1825326864062767e-7,
              zoom: 1,
            },
          ],
        ],
      }
    );
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
});

describe("anchored zoom", () => {
  const minSize = { height: 1500, width: 2000 };

  it.each<
    [
      string,
      CropperOptions,
      (cropper: Cropper) => void,
      { x: number; y: number },
      { x: number; y: number },
      { height: number; width: number },
    ]
  >([
    [
      "the minSize ceiling at a corner anchor",
      { minSize },
      (cropper) => {
        cropper.setZoom(2);
      },
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { height: 1500, width: 2000 },
    ],
    [
      "the minSize ceiling short of the request",
      { minSize },
      noop,
      { x: 0.25, y: 0.25 },
      { x: 0.375, y: 0.375 },
      { height: 1500, width: 2000 },
    ],
    [
      "a side already at the minimum",
      square(300),
      (cropper) => {
        cropper.setValue({
          center: { x: 0.5, y: 0.3 },
          size: { height: 0.3, width: 0.8 },
        });
      },
      { x: 0.5, y: 0.15 },
      { x: 0.5, y: 0.3 },
      { height: 300, width: 800 },
    ],
  ])(
    "holds the anchor at the zoom it reached when %s stops it",
    (_, options, prepare, anchor, center, size) => {
      const { cropper } = setup(options);

      prepare(cropper);
      cropper.setZoom(4, { anchor });
      expect(cropper.getValue().center.x).toBeCloseTo(center.x, 9);
      expect(cropper.getValue().center.y).toBeCloseTo(center.y, 9);
      expect(pixels(cropper)).toStrictEqual(size);
    }
  );
});

describe("minSize on a free crop", () => {
  const LONG = { size: { height: 0.4, width: 0.8 } };

  const pinched = (keep: "size" | "center") => (cropper: Cropper) => {
    cropper.setValue(LONG);
    const state = stateOf(cropper);

    cropper.setCropState(
      { ...state, crop: { ...state.crop, height: 200, width: 400 } },
      { keep }
    );
  };

  it.each<
    [
      string,
      CropperOptions,
      (cropper: Cropper) => void,
      { height: number; width: number },
    ]
  >([
    [
      "the short side of a long crop",
      square(100),
      (cropper) => {
        cropper.setValue({ size: { height: 1, width: 0.01 } });
      },
      { height: 1000, width: 100 },
    ],
    [
      "only the side under the minimum",
      square(100),
      (cropper) => {
        cropper.setValue({ size: { height: 0.2, width: 0.05 } });
      },
      { height: 200, width: 100 },
    ],
    [
      "both sides a quarter turn cannot hold",
      {
        image: { height: 200, width: 2000 },
        minSize: { height: 300, width: 300 },
        value: { ...defaultValue, quarterTurns: 1 },
      },
      (cropper) => {
        withCrop(cropper, { height: 740 });
      },
      { height: 740, width: 200 },
    ],
    [
      "a minimum that only just fits at the straighten limit",
      {
        image: { height: 365, width: 6122 },
        minSize: { height: 300, width: 300 },
        value: {
          ...defaultValue,
          rotation: 30,
          size: { height: 0.83, width: 0.056 },
        },
      },
      noop,
      { height: 300, width: 300 },
    ],
    [
      "a width from setCropState",
      square(100),
      (cropper) => {
        withCrop(cropper, { width: 10 });
      },
      { height: 1000, width: 100 },
    ],
    [
      "a width from defaultValue",
      { ...square(200), defaultValue: { size: { height: 1, width: 0.05 } } },
      noop,
      { height: 1000, width: 200 },
    ],
    [
      "a long crop's shape when a zoom stops at the minimum",
      square(300),
      (cropper) => {
        cropper.setValue(LONG);
        cropper.setZoom(2);
        cropper.setZoom(4);
      },
      { height: 300, width: 600 },
    ],
    [
      "a long crop's shape on the way back out",
      square(300),
      (cropper) => {
        cropper.setValue(LONG);
        cropper.setZoom(4);
        cropper.setZoom(1);
      },
      { height: 500, width: 1000 },
    ],
    [
      "a long crop's shape when a pinch holding its size stops",
      square(300),
      pinched("size"),
      { height: 300, width: 600 },
    ],
    [
      "a long crop's shape when a pinch holding its centre stops",
      square(300),
      pinched("center"),
      { height: 300, width: 600 },
    ],
    [
      "each side of a size setValue gives whole",
      square(300),
      (cropper) => {
        cropper.setValue(LONG);
        cropper.setValue({ size: { height: 0.1, width: 0.2 } });
      },
      { height: 300, width: 300 },
    ],
    [
      "the short side of a crop spanning the photo at a tiny angle",
      { image: null, minSize: { height: 1, width: 4000 } },
      (cropper) => {
        cropper.setValue({ rotation: 5e-13 });
        cropper.setImage(PHOTO);
      },
      { height: 1, width: 4000 },
    ],
  ])("holds %s", (_, options, write, size) => {
    const { cropper } = setup(options);

    write(cropper);
    const { crop } = stateOf(cropper);

    expect(sound(cropper.getValue())).toBeTruthy();

    expect({
      height: Math.round(crop.height),
      width: Math.round(crop.width),
    }).toStrictEqual(size);
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
          const state = stateOf(cropper);

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
});

describe("values handed out", () => {
  it("freezes every value and state the cropper holds", () => {
    const { change, commit, cropper, time } = setup();

    const first = [defaultValue, parse("{}") ?? {}, cropper.getValue()];

    cropper.setRotation(5);
    time.frame();

    expect(
      [
        ...first,
        cropper.getValue(),
        stateOf(cropper),
        change.mock.calls[0]?.[0] ?? {},
        commit.mock.calls[0]?.[0] ?? {},
        cropper.getState().committed,
      ].every(deepFrozen)
    ).toBeTruthy();

    const early = createCropper();

    (early as CropperInternals).retarget({ aspect: 1, lock: true });
    early.setValue({ rotation: 3 });
    expect(early.getValue().aspect).toBe(1);
    expect(deepFrozen(early.getValue())).toBeTruthy();
    early.destroy();
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

    expect([
      cropper.getValue().center.x,
      cropper.getValue().size.width,
      Object.isFrozen(shared),
    ]).toStrictEqual([0.5, 0.5, false]);

    const partial = { center: { x: 0.3, y: 0.3 } };

    cropper.setValue(partial);
    partial.center.x = 0.9;
    expect(cropper.getValue().center.x).toBe(0.3);
    cropper.setImage(PHOTO);
    const state = stateOf(cropper);
    const crop = { ...state.crop, width: 2000 };

    cropper.setCropState({ ...state, crop });
    crop.width = 100;

    expect([
      cropper.getCropState()?.crop.width,
      Object.isFrozen(crop),
    ]).toStrictEqual([2000, false]);
  });

  it("applies a change written on a copy of the value", () => {
    const { change, commit, cropper, time } = setup({
      value: { ...defaultValue, size: { height: 0.5, width: 0.5 } },
    });

    cropper.setValue({ ...cropper.getValue(), rotation: 2 });
    time.frames(2);
    expect(cropper.getCropState()?.angle).toBe(2);
    expect(change).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
  });
});

describe("frame timing", () => {
  it("hands a task no negative delta when the clock runs backward", () => {
    const steps: ((now: number) => void)[] = [];
    const cropper = createCropper({
      clock: {
        cancel: noop,
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
    const { commit, cropper, time } = setup();

    cropper.begin("dial");
    cropper.setRotation(10, { reason: "dial" });
    time.frame();
    cropper.setRotation(11, { reason: "dial" });
    cropper.end();

    cropper.setValue(
      { ...cropper.getValue(), rotation: 10 },
      { emit: false, reason: "controlled" }
    );

    cropper.setRotation(10, { reason: "controlled" });
    time.frame();
    expect(cropper.getValue().rotation).toBe(11);

    expect(
      commit.mock.calls.map(([value, details]) => ({
        reason: details.reason,
        rotation: value.rotation,
      }))
    ).toStrictEqual([{ reason: "dial", rotation: 11 }]);
  });
});

describe("reset", () => {
  it.each<[string, (cropper: Cropper) => void]>([
    ...[1e-12, 1e-11, 5e-11].map(
      (rotation): [string, (cropper: Cropper) => void] => [
        `a rotation of ${rotation}`,
        (cropper) => {
          cropper.setRotation(10);
          cropper.setRotation(rotation);
        },
      ]
    ),
    [
      "a size next to the full photo",
      (cropper) => {
        cropper.setZoom(2);
        cropper.setZoom(1.00000000001);
      },
    ],
  ])("reaches its value from %s inside the hold", (_, write) => {
    const { cropper } = setup({ image: { height: 3024, width: 4032 } });

    write(cropper);
    cropper.reset();
    expect(cropper.getValue().rotation).toBe(0);
    expect(cropper.getValue().size).toStrictEqual({ height: 1, width: 1 });
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("returns to a zoom from the first render, follows a new photo and lets the target go", () => {
    const { cropper } = setup();
    const drop = (cropper as CropperInternals).retarget({ zoom: 2 });

    const pristine: boolean[] = [];

    cropper.setZoom(2, { emit: false });
    pristine.push(cropper.getState().pristine);
    cropper.setZoom(5);
    pristine.push(cropper.getState().pristine);
    cropper.reset();
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    pristine.push(cropper.getState().pristine);
    cropper.setImage({ height: 1000, width: 3000 });
    cropper.setZoom(2, { emit: false });
    pristine.push(cropper.getState().pristine);
    expect(pristine).toStrictEqual([true, false, true, true]);
    drop();
    cropper.reset();
    expect(cropper.getZoom()).toBeCloseTo(1, 6);
  });
});

describe("the aspect it already has", () => {
  it.each<
    [string, CropValue["aspect"], CropValue["aspect"], number, number, boolean]
  >([
    ["a ratio again", 1, 1, 3, 0, true],
    ["the photo's own again", "original", "original", 3, 0, true],
    ["a new ratio", 1, 16 / 9, 1, 1, false],
  ])(
    "commits only when %s changes the crop",
    (_, start, aspect, zoom, commits, same) => {
      const { commit, cropper, time } = setup({
        defaultValue: { aspect: start },
      });

      cropper.setZoom(3);
      time.frames(2);
      commit.mockClear();
      const before = cropper.getValue();

      cropper.setAspect(aspect);
      time.frames(2);
      expect(cropper.getZoom()).toBeCloseTo(zoom, 6);
      expect(commit).toHaveBeenCalledTimes(commits);
      expect(cropper.getValue() === before).toBe(same);
    }
  );
});

describe("minSize across quarter turns", () => {
  it("reads along the photo's sides, so a turn keeps the crop at the floor", () => {
    const { cropper } = floored();
    const zoom = cropper.getZoom();

    expect(cropper.getPixelCrop()?.width).toBe(1200);
    cropper.rotate90();
    expect(cropper.getZoom()).toBeCloseTo(zoom, 6);
    expect(cropper.getPixelCrop()?.width).toBe(630);
    expect(cropper.getPixelCrop()?.height).toBe(1200);
    const { cropper: roomy } = setup({
      defaultValue: { quarterTurns: 1 },
      image: { height: 1000, width: 4000 },
      minSize: { height: 500, width: 3000 },
    });

    roomy.setZoom(1.2);
    expect(roomy.getZoom()).toBeCloseTo(1.2, 6);
  });
});

describe("the cropper's public type", () => {
  it("names eight events, keeps the internal calls out and lets setOptions take only what it honours", () => {
    expectTypeOf<keyof CropperEvents>().toEqualTypeOf<
      | "change"
      | "commit"
      | "destroy"
      | "frame"
      | "gestureend"
      | "gesturestart"
      | "settle"
      | "stop"
    >();

    expectTypeOf<Cropper>().not.toHaveProperty("coast");
    expectTypeOf<Cropper>().not.toHaveProperty("getMinSize");
    expectTypeOf<Cropper>().not.toHaveProperty("rebase");
    expectTypeOf<Cropper>().not.toHaveProperty("retarget");

    expectTypeOf<Parameters<Cropper["setOptions"]>[0]>().toEqualTypeOf<
      Pick<
        CropperOptions,
        | "disabled"
        | "focalLength"
        | "maxZoom"
        | "minSize"
        | "onValueChange"
        | "onValueCommit"
      >
    >();
  });
});
