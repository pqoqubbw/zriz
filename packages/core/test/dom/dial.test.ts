import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { CropperEvents, CropperOptions } from "../../src";
import { dialHandlers } from "../../src/dom/dial";
import type { DialOptions } from "../../src/dom/dial";
import { decay } from "../../src/motion";
import { fakeClock } from "../fake-clock";

const PHOTO = { height: 3000, width: 4000 };

class InputEvent extends Event {
  constructor(type: string, init: object) {
    super(type, { cancelable: true });
    Object.assign(this, init);
  }
}

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
  const time = fakeClock();
  const commit = vi.fn<CropperEvents["commit"]>();
  const cropper = createCropper({
    clock: time.clock,
    image,
    onValueCommit: (value, details) => {
      commit(value, details);
    },
  });

  time.frame();

  return { commit, cropper, handlers: dialHandlers(cropper, dial), time };
};

describe("dial handlers", () => {
  beforeEach(() => {
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("addEventListener", vi.fn<() => void>());
    vi.stubGlobal("removeEventListener", vi.fn<() => void>());
    vi.stubGlobal("Element", Map);
    vi.stubGlobal("KeyboardEvent", InputEvent);
    vi.stubGlobal("PointerEvent", InputEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["ArrowRight", true, "ltr", 10],
    ["ArrowUp", true, "ltr", 10],
    ["ArrowLeft", true, "ltr", -10],
    ["ArrowDown", true, "ltr", -10],
    ["ArrowRight", true, "rtl", -10],
    ["ArrowLeft", true, "rtl", 10],
    ["ArrowUp", true, "rtl", 10],
    ["ArrowDown", true, "rtl", -10],
    ["ArrowRight", false, "ltr", 1],
    ["PageUp", false, "ltr", 10],
    ["PageDown", false, "ltr", -10],
    ["PageDown", true, "ltr", -10],
  ] as const)(
    "moves on %s, shift %s, %s to %d",
    (key, shift, dir, rotation) => {
      const { cropper, handlers } = setup({ dir });
      const event = press(key, shift);

      handlers.onKeyDown(event);
      expect(cropper.getValue().rotation).toBe(rotation);
      expect(event.defaultPrevented).toBeTruthy();
    }
  );

  it("stops a big step at the limit", () => {
    const { cropper, handlers } = setup();

    cropper.setRotation(40);
    handlers.onKeyDown(press("ArrowRight", true));
    expect(cropper.getValue().rotation).toBe(45);
  });

  it.each(["a", "Tab", "Shift", "Enter", "1"])(
    "leaves %s to the page",
    (key) => {
      const { commit, cropper, handlers, time } = setup();
      const event = press(key);

      handlers.onKeyDown(event);
      expect(event.defaultPrevented).toBeFalsy();
      expect(cropper.getState().interacting).toBeNull();
      time.frames(2);
      expect(commit).not.toHaveBeenCalled();
    }
  );

  it("does not turn by key while another gesture holds the cropper", () => {
    const { cropper, handlers } = setup();

    cropper.begin("pan", undefined, "other");
    handlers.onKeyDown(press("ArrowRight"));
    expect(cropper.getValue().rotation).toBe(0);
    expect(cropper.getState().interacting).toBe("pan");
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

  it.each([1, 2, 3, 4])("ignores mouse button %d", (button) => {
    const { cropper, handlers } = setup();

    handlers.onPointerDown(down({ button }));
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
    handlers.onPointerMove(down({ clientX: 150 }));
    expect(cropper.getValue().rotation).toBe(10);
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
const RELEASED = (MOVES * STEP - SLOP) / GAIN;
const REST = RELEASED + (SPEED / 1000) * TAU;

const isPointerEvent = (value: unknown): value is PointerEvent =>
  typeof value === "object" && value !== null && "clientX" in value;

const isElement = (value: unknown): value is Element =>
  typeof value === "object" && value !== null && "setPointerCapture" in value;

const pointer = (clientX: number, timeStamp: number): PointerEvent => {
  const event: unknown = {
    button: 0,
    clientX,
    clientY: 20,
    pointerId: 1,
    pointerType: "mouse",
    target: null,
    timeStamp,
  };

  if (!isPointerEvent(event)) {
    throw new TypeError("not a pointer event");
  }

  return event;
};

const stubElement = (): Element => {
  const element: unknown = {
    getBoundingClientRect: () => ({ width: 361 }),
    getClientRects: () => [{}],
    ownerDocument: {},
    setPointerCapture: () => null,
  };

  if (!isElement(element)) {
    throw new TypeError("not an element");
  }

  return element;
};

const throwSlowly = (hz: number) => {
  const fake = fakeClock();
  const commit = vi.fn<() => void>();
  const cropper = createCropper({
    clock: fake.clock,
    image: { height: 3000, width: 4000 },
    onValueCommit: commit,
  });
  const element = stubElement();
  const handlers = dialHandlers(cropper, {}, () => element);
  const frame = 1000 / hz;
  let x = 100;
  let time = 0;

  handlers.onPointerDown(pointer(x, time));

  for (let i = 0; i < MOVES; i += 1) {
    x += STEP;
    time += INTERVAL;
    handlers.onPointerMove(pointer(x, time));
    fake.frame(INTERVAL);
  }

  handlers.onPointerUp(pointer(x, time));
  const released = cropper.getValue().rotation;
  const gliding = cropper.getState().interacting;
  const trace: number[] = [];
  let commitsWhileGliding = 0;

  while (cropper.getState().settling && trace.length < 1000) {
    commitsWhileGliding = commit.mock.calls.length;
    fake.frame(frame);
    trace.push(cropper.getValue().rotation);
  }

  const rested = cropper.getState().interacting;

  fake.frame(frame);
  const result = {
    commit,
    commitsWhileGliding,
    error: Math.max(
      ...trace.map((rotation, i) =>
        Math.abs(rotation - (released + decay(SPEED, TAU, i * frame).value))
      )
    ),
    gliding,
    nextGesture: cropper.begin("pan", undefined, {}),
    pending: fake.pending(),
    released,
    rest: cropper.getValue().rotation,
    rested,
    settled: !cropper.getState().settling,
  };

  cropper.destroy();

  return result;
};

describe("a thrown dial that stops before the limit", () => {
  beforeEach(() => {
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("addEventListener", vi.fn<() => void>());
    vi.stubGlobal("removeEventListener", vi.fn<() => void>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([60, 120])("follows the decay curve at %d Hz", (hz) => {
    const { error, released, rest } = throwSlowly(hz);

    expect(released).toBeCloseTo(RELEASED, 9);
    expect(error).toBeLessThan(1e-6);
    expect(rest).toBeCloseTo(REST, 1);
    expect(rest).toBeLessThan(LIMIT);
  });

  it("commits once when it stops and frees the cropper", () => {
    const { commit, commitsWhileGliding, gliding, nextGesture, rested } =
      throwSlowly(60);

    expect(gliding).toBe("dial");
    expect(commitsWhileGliding).toBe(0);
    expect(commit).toHaveBeenCalledOnce();
    expect(rested).toBeNull();
    expect(nextGesture).toBeTruthy();
  });

  it("leaves no frame running once it has stopped", () => {
    const { pending, settled } = throwSlowly(60);

    expect(settled).toBeTruthy();
    expect(pending).toBe(0);
  });
});
