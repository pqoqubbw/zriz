import { describe, expect, it } from "vitest";

import type { Cropper, CropperOptions } from "../../src";
import {
  areaKeyHandlers,
  dialState,
  viewOf,
  zoomHandlers,
} from "../../src/dom";
import type { DialHandlers, KeyHandlers } from "../../src/dom";
import { dialHandlers } from "../../src/dom/dial";
import type { DialOptions } from "../../src/dom/dial";
import {
  dialTrack,
  PHOTO,
  pointer,
  setup as rig,
  stubDom,
} from "../cropper-fixture";

const down = (init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent("pointerdown", {
    button: 0,
    clientX: 100,
    clientY: 20,
    pointerId: 1,
    pointerType: "mouse",
    ...init,
  });

const press = (key: string, shiftKey = false): KeyboardEvent =>
  new KeyboardEvent("keydown", { key, shiftKey });

const setup = (dial?: DialOptions, image: CropperOptions["image"] = PHOTO) => {
  const { commit, cropper, time } = rig({ image });

  time.frame();

  return { commit, cropper, handlers: dialHandlers(cropper, dial), time };
};

describe("dial handlers", () => {
  stubDom();

  it.each([
    ["ArrowRight", true, "ltr", 0, 10],
    ["ArrowUp", true, "ltr", 0, 10],
    ["ArrowLeft", true, "ltr", 0, -10],
    ["ArrowDown", true, "ltr", 0, -10],
    ["ArrowRight", true, "rtl", 0, -10],
    ["ArrowLeft", true, "rtl", 0, 10],
    ["ArrowUp", true, "rtl", 0, 10],
    ["ArrowDown", true, "rtl", 0, -10],
    ["ArrowRight", false, "ltr", 0, 1],
    ["PageUp", false, "ltr", 0, 10],
    ["PageDown", false, "ltr", 0, -10],
    ["PageDown", true, "ltr", 0, -10],
    ["ArrowRight", true, "ltr", 40, 45],
  ] as const)(
    "moves on %s, shift %s, %s from %d to %d",
    (key, shift, dir, start, rotation) => {
      const { cropper, handlers } = setup({ dir });
      const event = press(key, shift);

      cropper.setRotation(start);
      handlers.onKeyDown(event);
      expect(cropper.getValue().rotation).toBe(rotation);
      expect(event.defaultPrevented).toBeTruthy();
    }
  );

  it.each(["Tab", "a"])("leaves %s to the page", (key) => {
    const { commit, cropper, handlers, time } = setup();
    const event = press(key);

    handlers.onKeyDown(event);
    expect(event.defaultPrevented).toBeFalsy();
    expect(cropper.getState().interacting).toBeNull();
    time.frames(2);
    expect(commit).not.toHaveBeenCalled();
  });

  it("ends the gesture on a tap without a turn or a commit", () => {
    const { commit, cropper, handlers, time } = setup();

    handlers.onPointerDown(down());
    expect(cropper.getState().interacting).toBe("dial");
    handlers.onPointerUp(down());
    expect(cropper.getState().interacting).toBeNull();
    time.frames(3);
    expect(cropper.getValue().rotation).toBe(0);
    expect(commit).not.toHaveBeenCalled();
  });

  it("ignores a right-button press", () => {
    const { cropper, handlers } = setup();

    handlers.onPointerDown(down({ button: 2 }));
    expect(cropper.getState().interacting).toBeNull();
    handlers.onPointerMove(down({ clientX: 200 }));
    expect(cropper.getValue().rotation).toBe(0);
  });

  it("keeps the first pointer when a second one presses", () => {
    const { cropper, handlers } = setup();

    handlers.onPointerDown(down());
    handlers.onPointerDown(down({ clientX: 300, pointerId: 2 }));
    handlers.onPointerMove(down({ clientX: 400, pointerId: 2 }));
    expect(cropper.getValue().rotation).toBe(0);
    handlers.onPointerMove(down({ clientX: 50 }));
    expect(cropper.getValue().rotation).toBe(9);
    handlers.onPointerUp(down({ clientX: 400, pointerId: 2 }));
    expect(cropper.getState().interacting).toBe("dial");
  });

  it("ignores a press before an image is there", () => {
    const { cropper, handlers } = setup({}, null);

    handlers.onPointerDown(down());
    expect(cropper.getState().interacting).toBeNull();
  });
});

const LIMIT = 45;
const TAU = 95;
const GAIN = 4;
const SLOP = 10;
const STEP = 6;
const MOVES = 10;
const INTERVAL = 16;
const SPEED = ((STEP / INTERVAL) * 1000) / GAIN;
const SNAP_ZONE = 1;
const RELEASED = (MOVES * STEP - SLOP) / GAIN - SNAP_ZONE;
const REST = RELEASED + (SPEED / 1000) * TAU;

const throwDial = (from = 0) => {
  const { cropper, time: clock } = rig();
  const element = dialTrack();
  const handlers = dialHandlers(cropper, {}, () => element);
  let x = 100;
  let time = 0;

  cropper.setRotation(from);
  handlers.onPointerDown(pointer(x, time));

  for (let i = 0; i < MOVES; i += 1) {
    x -= STEP;
    time += INTERVAL;
    handlers.onPointerMove(pointer(x, time));
    clock.frame(INTERVAL);
  }

  handlers.onPointerUp(pointer(x, time));

  return { clock, cropper, handlers, time, x };
};

const throwSlowly = (hz: number) => {
  const { clock, cropper } = throwDial();
  const frame = 1000 / hz;
  const released = cropper.getValue().rotation;
  let frames = 0;

  while (cropper.getState().settling && frames < 1000) {
    clock.frame(frame);
    frames += 1;
  }

  clock.frame(frame);
  const result = {
    pending: clock.pending(),
    released,
    rest: cropper.getValue().rotation,
    settled: !cropper.getState().settling,
  };

  cropper.destroy();

  return result;
};

const throwFrom = (from: number, stop: "none" | "press" | "release") => {
  const { clock, cropper, handlers, time, x } = throwDial(from);
  let frames = 0;

  while (cropper.getState().settling && frames < 1000) {
    clock.frame(INTERVAL);
    frames += 1;

    if (stop !== "none" && Math.abs(cropper.getValue().rotation) <= SNAP_ZONE) {
      break;
    }
  }

  const before = cropper.getValue().rotation;

  if (stop === "press") {
    handlers.onPointerDown(pointer(x, time + frames * INTERVAL));
  }

  if (stop === "release") {
    handlers.release();
    clock.frame(INTERVAL);
  }

  const result = { before, rest: cropper.getValue().rotation };

  cropper.destroy();

  return result;
};

const dragTo = (from: number, ...xs: number[]): number[] => {
  const { cropper, handlers } = setup();

  cropper.setRotation(from);
  handlers.onPointerDown(down());

  return xs.map((x) => {
    handlers.onPointerMove(down({ clientX: x }));

    return cropper.getValue().rotation;
  });
};

describe("the dial near 0°", () => {
  stubDom();

  it("holds 0° within 1°, leaves it without a jump, and snaps to it from a straightened photo", () => {
    expect({
      held: dragTo(0, 88, 86, 94),
      left: dragTo(0, 86, 85),
      snapped: dragTo(5, 115, 126, 130),
    }).toStrictEqual({
      held: [0, 0, 0],
      left: [0, expect.closeTo(0.25, 9)],
      snapped: [expect.closeTo(3.75, 9), 0, 0],
    });
  });
});

describe("a thrown dial that stops before the limit", () => {
  stubDom();

  it("stops its glide when a new photo lands, at any size and after an empty cropper", () => {
    const swaps = [[PHOTO], [{ height: 2000, width: 1000 }], [null, PHOTO]];
    const seen = swaps.map((swap) => {
      const { clock, cropper } = throwDial();
      const thrown = cropper.getState().interacting;

      for (const image of swap) {
        cropper.setImage(image);
      }

      const swapped = cropper.getState().interacting;
      const at = cropper.getValue().rotation;

      clock.frames(30);

      return [thrown, swapped, cropper.getValue().rotation === at];
    });

    expect(seen).toStrictEqual(swaps.map(() => ["dial", null, true]));
  });

  it.each([60, 120])(
    "comes to the same rest at %d Hz and leaves no frame running",
    (hz) => {
      const { pending, released, rest, settled } = throwSlowly(hz);

      expect(released).toBeCloseTo(RELEASED, 9);
      expect(rest).toBeCloseTo(REST, 1);
      expect(rest).toBeLessThan(LIMIT);
      expect(settled).toBeTruthy();
      expect(pending).toBe(0);
    }
  );

  it("snaps to 0° when it comes to rest within 1°", () => {
    const { before, rest } = throwFrom(-21, "none");

    expect(before).toBe(0);
    expect(rest).toBe(0);
  });

  it.each(["press", "release"] as const)(
    "stays where a %s stops it near 0°",
    (stop) => {
      const { before, rest } = throwFrom(-21, stop);

      expect(before).not.toBe(0);
      expect(Math.abs(before)).toBeLessThanOrEqual(SNAP_ZONE);
      expect(rest).toBe(before);
    }
  );
});

const stamped = (
  type: string,
  clientX: number,
  timeStamp = 0
): PointerEvent => {
  const event = new PointerEvent(type, {
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX,
    clientY: 20,
    pointerId: 1,
    pointerType: "mouse",
  });

  Object.defineProperty(event, "timeStamp", { value: timeStamp });

  return event;
};

const keyDown = (key: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent("keydown", { key, ...init });

const keyUp = (key: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent("keyup", { key, ...init });

const bound = () => {
  const fixture = rig();
  const reasons: string[] = [];

  fixture.commit.mockImplementation((_, details) => {
    reasons.push(details.reason);
  });

  const handlers = dialHandlers(fixture.cropper, {}, () => dialTrack());

  return { ...fixture, handlers, reasons };
};

const glide = (handlers: DialHandlers, from: number, by: number): void => {
  handlers.onPointerDown(stamped("pointerdown", from, 0));

  for (let i = 1; i <= 5; i += 1) {
    handlers.onPointerMove(stamped("pointermove", from + i * by, i * 16));
  }

  handlers.onPointerUp(stamped("pointerup", from + 5 * by, 80));
};

const turnAfter = (path: readonly (readonly [number, number])[]): number => {
  const { cropper, handlers, time } = bound();
  const [first, ...rest] = path;
  let last = first ?? [0, 0];

  handlers.onPointerDown(stamped("pointerdown", last[0], last[1]));

  for (const sample of rest) {
    handlers.onPointerMove(stamped("pointermove", sample[0], sample[1]));
    last = sample;
  }

  handlers.onPointerUp(stamped("pointerup", last[0], last[1] + 1));
  time.frames(200);

  return cropper.getValue().rotation;
};

describe("dial gestures in handlers", () => {
  stubDom();

  it("stays put when a stopped pointer twitches before the release and still throws after a real flick", () => {
    expect(
      turnAfter([
        [180, 0],
        [190, 8],
        [210, 16],
        [230, 24],
        [231, 124],
        [233, 125],
      ])
    ).toBeCloseTo(-9.75, 1);

    expect(
      turnAfter([
        [100, 0],
        [85, 8],
        [70, 16],
        [55, 24],
        [40, 32],
      ])
    ).toBeGreaterThan(20);
  });

  it.each<[string, (handlers: DialHandlers) => Event]>([
    [
      "a key",
      (handlers) => {
        const event = keyDown("ArrowRight");

        handlers.onKeyDown(event);

        return event;
      },
    ],
    [
      "a press",
      (handlers) => {
        const event = stamped("pointerdown", 100, 100);

        handlers.onPointerDown(event);

        return event;
      },
    ],
  ])(
    "leaves %s to the page while disabled and lets a running throw finish",
    (_, refused) => {
      const { cropper, handlers, time } = bound();

      glide(handlers, 100, 12);
      expect(cropper.getState().interacting).toBe("dial");
      cropper.setOptions({ disabled: true });
      expect(refused(handlers).defaultPrevented).toBeFalsy();
      time.frames(200);
      cropper.setOptions({ disabled: false });
      expect(cropper.getState().interacting).toBeNull();
      expect(cropper.begin("pan", undefined, {})).toBeTruthy();
    }
  );

  it.each([
    ["gain", { gain: 0 }],
    ["tau", { tau: 0 }],
    ["gain", { gain: Number.NaN }],
    ["tau", { tau: -1 }],
  ])("falls back to the default %s", (_, options) => {
    const { cropper, time } = rig();
    const handlers = dialHandlers(cropper, options, () => dialTrack());

    handlers.onPointerDown(stamped("pointerdown", 100));

    for (const [index, x] of [130, 160, 190, 220].entries()) {
      handlers.onPointerMove(stamped("pointermove", x, (index + 1) * 16));
      time.frame();
    }

    handlers.onPointerUp(stamped("pointerup", 220, 80));
    time.frames(2000);
    expect(Number.isFinite(cropper.getValue().rotation)).toBeTruthy();
    expect(Number.isFinite(cropper.getValue().center.x)).toBeTruthy();
    expect(Number.isNaN(dialState(cropper).overshoot())).toBeFalsy();
    expect(cropper.getState().settling).toBeFalsy();
  });

  it("leaves a drag alone when a key is tapped during it, in either order", () => {
    const first = bound();

    first.handlers.onPointerDown(stamped("pointerdown", 100));
    first.handlers.onPointerMove(stamped("pointermove", 160, 16));
    const event = keyDown("ArrowRight");

    first.handlers.onKeyDown(event);
    expect(event.defaultPrevented).toBeTruthy();
    first.handlers.onKeyUp(keyUp("ArrowRight"));
    first.time.frames(2);
    expect(first.cropper.getState().interacting).toBe("dial");
    expect(first.reasons).toStrictEqual([]);
    first.handlers.onPointerUp(stamped("pointerup", 160, 32));
    first.time.frames(2);
    expect(first.reasons).toHaveLength(1);

    const second = bound();

    second.handlers.onKeyDown(keyDown("ArrowRight"));
    second.handlers.onPointerDown(stamped("pointerdown", 100));
    second.handlers.onPointerMove(stamped("pointermove", 160, 16));
    second.handlers.onKeyUp(keyUp("ArrowRight"));
    second.time.frames(2);
    expect(second.cropper.getState().interacting).toBe("dial");
  });

  it("carries the pointer event on changes during a drag", () => {
    const { cropper, handlers, time } = bound();
    const events: (Event | undefined)[] = [];

    cropper.on("change", (_, details) => {
      events.push(details.event);
    });

    handlers.onPointerDown(stamped("pointerdown", 100));
    const move = stamped("pointermove", 160, 16);

    handlers.onPointerMove(move);
    time.frames(1);
    expect(events[0]).toBe(move);
  });

  it("keeps a write made during a drag through the next move", () => {
    const { cropper, handlers } = bound();

    handlers.onPointerDown(stamped("pointerdown", 100));
    handlers.onPointerMove(stamped("pointermove", 40, 16));
    cropper.setZoom(3, { reason: "zoom-control" });
    const { rotation } = cropper.getValue();

    handlers.onPointerMove(stamped("pointermove", 36, 32));
    expect(cropper.getZoom()).toBeGreaterThan(2);
    expect(cropper.getValue().rotation).toBeCloseTo(rotation + 1, 6);
  });

  it("stops a glide on a write and keeps the write's reason", () => {
    const { cropper, handlers, time } = bound();

    glide(handlers, 100, 15);
    time.frames(3);
    expect(cropper.getState().interacting).toBe("dial");
    const reasons: string[] = [];

    cropper.on("change", (_, details) => {
      reasons.push(details.reason);
    });

    cropper.reset();
    expect(cropper.getState().interacting).toBeNull();
    time.frames(30);
    expect(cropper.getValue().rotation).toBe(0);
    expect(reasons).toStrictEqual(["reset"]);
    expect(viewOf(cropper).chrome().transition).toBeNull();
  });

  it("lets the ruler settle after a press during a bounce past the limit", () => {
    const { cropper, handlers, time } = bound();

    cropper.setRotation(20);
    time.frames(1);
    glide(handlers, 100, -20);
    time.frames(6);
    expect(dialState(cropper).overshoot()).not.toBe(0);
    handlers.onPointerDown(stamped("pointerdown", 0, 200));
    handlers.onPointerUp(stamped("pointerup", 0, 201));
    time.frames(120);
    expect(dialState(cropper).overshoot()).toBe(0);
  });

  it("keeps the ruler where it was when the dial is grabbed again", () => {
    const { cropper, handlers, time } = bound();

    handlers.onPointerDown(stamped("pointerdown", 500));
    handlers.onPointerMove(stamped("pointermove", 100, 16));
    handlers.onPointerUp(stamped("pointerup", 100, 32));
    time.frames(2);
    const over = dialState(cropper).overshoot();

    expect(over).toBeGreaterThan(20);
    handlers.onPointerDown(stamped("pointerdown", 300, 100));
    handlers.onPointerMove(stamped("pointermove", 288, 116));
    expect(dialState(cropper).overshoot()).toBeGreaterThan(over * 0.8);
  });

  it("leaves another dial's drag alone when one dial settles", () => {
    const { cropper, handlers, time } = bound();
    const other = dialHandlers(cropper, {}, () => dialTrack());

    handlers.onPointerDown(stamped("pointerdown", 100));
    handlers.onPointerMove(stamped("pointermove", 500, 16));
    handlers.onPointerUp(stamped("pointerup", 500, 32));
    time.frames(2);
    other.onPointerDown(stamped("pointerdown", 100, 100));
    other.onPointerMove(stamped("pointermove", 130, 108));
    time.frames(3);
    expect(dialState(cropper).dragging()).toBeTruthy();
  });

  it("commits a held arrow once when shift comes up", () => {
    const { handlers, reasons, time } = bound();

    handlers.onKeyDown(keyDown("ArrowRight"));
    time.frames(1);
    handlers.onKeyUp(keyUp("Shift"));
    time.frames(1);
    handlers.onKeyDown(keyDown("ArrowRight", { repeat: true }));
    handlers.onKeyUp(keyUp("ArrowRight"));
    time.frames(1);
    expect(reasons).toHaveLength(1);
  });
});

describe.each<[string, (cropper: Cropper) => KeyHandlers]>([
  ["dial", (cropper) => dialHandlers(cropper)],
  ["zoom", (cropper) => zoomHandlers(cropper)],
  ["area", (cropper) => areaKeyHandlers(cropper)],
])("%s with a key held down", (_, handlersOf) => {
  stubDom();

  const held = () => {
    const { cropper } = rig();

    cropper.setValue({ size: { height: 0.5, width: 0.5 } });
    let started = 0;

    cropper.on("gesturestart", () => {
      started += 1;
    });

    const handlers = handlersOf(cropper);
    const first = keyDown("ArrowRight");

    handlers.onKeyDown(first);
    expect(first.defaultPrevented).toBeTruthy();

    return { cropper, handlers, starts: () => started };
  };

  it("keeps one gesture over every repeat and opens a new one when a repeat follows stop", () => {
    const { cropper, handlers, starts } = held();
    const before = cropper.getValue();
    const repeat = keyDown("ArrowRight");

    handlers.onKeyDown(repeat);
    const moved = cropper.getValue() !== before;
    const once = starts();

    cropper.stop();
    const after = keyDown("ArrowRight");

    handlers.onKeyDown(after);
    const { interacting } = cropper.getState();

    handlers.onKeyUp(keyUp("ArrowRight"));

    expect({
      ended: cropper.getState().interacting,
      interacting,
      moved,
      once,
      prevented: [repeat.defaultPrevented, after.defaultPrevented],
      starts: starts(),
    }).toStrictEqual({
      ended: null,
      interacting: "keyboard",
      moved: true,
      once: 1,
      prevented: [true, true],
      starts: 2,
    });
  });

  it("ends a held key when its handlers are released or meta comes up, and not on another modifier", () => {
    const released = held();

    released.handlers.release();
    const meta = held();

    meta.handlers.onKeyDown(
      keyDown("Meta", { code: "MetaLeft", metaKey: true })
    );

    meta.handlers.onKeyUp(keyUp("Shift", { code: "ShiftLeft" }));
    const shifted = meta.cropper.getState().interacting;

    meta.handlers.onKeyUp(keyUp("Meta", { code: "MetaLeft" }));

    expect({
      meta: meta.cropper.getState().interacting,
      released: released.cropper.getState().interacting,
      shifted,
    }).toStrictEqual({ meta: null, released: null, shifted: "keyboard" });
  });

  it.each<[string, (cropper: Cropper) => void, string | null]>([
    [
      "once disabled",
      (cropper) => {
        cropper.setOptions({ disabled: true });
      },
      null,
    ],
    [
      "under another owner after stop",
      (cropper) => {
        cropper.stop();
        expect(cropper.begin("pan", undefined, {})).toBeTruthy();
      },
      "pan",
    ],
  ])("leaves a repeat to the page %s", (_name, block, owner) => {
    const { cropper, handlers } = held();

    block(cropper);
    const before = cropper.getValue();
    const repeat = keyDown("ArrowRight");

    handlers.onKeyDown(repeat);
    expect(repeat.defaultPrevented).toBeFalsy();
    expect(cropper.getValue()).toBe(before);
    handlers.onKeyUp(keyUp("ArrowRight"));
    expect(cropper.getState().interacting).toBe(owner);
  });
});

describe("keys the browser keeps", () => {
  stubDom();

  it.each<
    [
      string,
      (cropper: Cropper) => KeyHandlers,
      string[],
      KeyboardEventInit[],
      string[],
    ]
  >([
    [
      "dial",
      (cropper) => dialHandlers(cropper),
      ["0", "ArrowLeft", "Home"],
      [{ metaKey: true }, { ctrlKey: true }, { altKey: true }],
      [],
    ],
    [
      "zoom",
      (cropper) => zoomHandlers(cropper),
      ["ArrowLeft"],
      [{ metaKey: true }, { ctrlKey: true }, { altKey: true }],
      [],
    ],
    [
      "area",
      (cropper) => areaKeyHandlers(cropper),
      ["0", "=", "-", "ArrowLeft"],
      [{ metaKey: true }, { ctrlKey: true }],
      [],
    ],
    [
      "area with alt",
      (cropper) => areaKeyHandlers(cropper),
      ["0", "=", "-"],
      [{ altKey: true }],
      ["ArrowRight"],
    ],
  ])(
    "leaves modified keys on the %s to the browser",
    (_, handlersOf, keys, inits, taken) => {
      const { cropper } = rig();

      cropper.setZoom(2);
      cropper.setRotation(10);
      const before = cropper.getValue();
      const handlers = handlersOf(cropper);

      for (const init of inits) {
        for (const name of keys) {
          const event = keyDown(name, init);

          handlers.onKeyDown(event);
          expect(event.defaultPrevented).toBeFalsy();
          handlers.onKeyUp(keyUp(name, init));
        }
      }

      expect(cropper.getValue()).toBe(before);

      for (const name of taken) {
        const event = keyDown(name, inits[0]);

        handlers.onKeyDown(event);
        expect(event.defaultPrevented).toBeTruthy();
      }
    }
  );

  it.each<[string, (cropper: Cropper) => DialHandlers]>([
    ["dial", (cropper) => dialHandlers(cropper)],
    ["zoom", (cropper) => zoomHandlers(cropper)],
  ])("starts nothing on the %s before any photo", (_, handlersOf) => {
    const { cropper } = rig();

    cropper.setImage(null);
    const handlers = handlersOf(cropper);
    const event = keyDown("ArrowRight");

    handlers.onKeyDown(event);
    handlers.onPointerDown?.(stamped("pointerdown", 100));
    expect(event.defaultPrevented).toBeFalsy();
    expect(cropper.getState().interacting).toBeNull();
  });
});
