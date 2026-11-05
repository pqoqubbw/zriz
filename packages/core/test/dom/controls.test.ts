import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Cropper, CropperOptions } from "../../src";
import {
  areaKeyHandlers,
  zoomAt,
  zoomHandlers,
  zoomProgress,
} from "../../src/dom/controls";
import { dialHandlers, dialState, tickData } from "../../src/dom/dial";
import { viewOf } from "../../src/dom/view";
import { fakeClock } from "../fake-clock";

type KeyInit = {
  altKey?: boolean;
  key: string;
  shiftKey?: boolean;
};

const isObject = (value: unknown): boolean =>
  typeof value === "object" && value !== null;
const isKey = (value: unknown): value is KeyboardEvent => isObject(value);
const isFocus = (value: unknown): value is FocusEvent => isObject(value);
const isPointer = (value: unknown): value is PointerEvent => isObject(value);
const isElement = (value: unknown): value is Element => isObject(value);

const cast = <T>(value: unknown, is: (value: unknown) => value is T): T => {
  if (!is(value)) {
    throw new Error("unreachable");
  }

  return value;
};

const key = (init: KeyInit): KeyboardEvent =>
  cast(
    {
      altKey: false,
      currentTarget: null,
      preventDefault: () => {},
      shiftKey: false,
      ...init,
    },
    isKey
  );

const blur = (): FocusEvent => cast({}, isFocus);

const pointer = (clientX: number, timeStamp: number): PointerEvent =>
  cast(
    {
      button: 0,
      clientX,
      clientY: 20,
      pointerId: 1,
      pointerType: "touch",
      target: null,
      timeStamp,
    },
    isPointer
  );

const track: Element = cast(
  {
    getBoundingClientRect: () => ({ width: 361 }),
    getClientRects: () => [{}],
    ownerDocument: {},
    setPointerCapture: () => {},
  },
  isElement
);

const setup = (options: CropperOptions = {}) => {
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 300, width: 400 },
    ...options,
  });

  return { cropper, time };
};

const press = (
  handlers: ReturnType<typeof areaKeyHandlers>,
  init: KeyInit
): void => {
  handlers.onKeyDown(key(init));
  handlers.onKeyUp(key(init));
};

const gridRig = () => {
  const { cropper, time } = setup();
  const view = viewOf(cropper);

  view.setLayout({
    dpr: 1,
    height: 300,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 400,
  });

  return { cropper, time, view };
};

describe("the fine grid", () => {
  beforeEach(() => {
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("addEventListener", vi.fn<() => void>());
    vi.stubGlobal("removeEventListener", vi.fn<() => void>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays off on a press that does not move", () => {
    const { cropper, time, view } = gridRig();
    const handlers = dialHandlers(cropper, {}, () => track);

    handlers.onPointerDown(pointer(100, 0));
    time.frames(70);
    expect(view.chrome().grid).toBe("none");
    expect(view.chrome().active).toBeTruthy();
    handlers.onPointerUp(pointer(100, 1200));
  });

  it("appears on the first movement past the slop", () => {
    const { cropper, time, view } = gridRig();
    const handlers = dialHandlers(cropper, {}, () => track);

    handlers.onPointerDown(pointer(100, 0));
    handlers.onPointerMove(pointer(105, 8));
    time.frame();
    expect(view.chrome().grid).toBe("none");
    handlers.onPointerMove(pointer(130, 16));
    time.frame();
    expect(view.chrome().grid).toBe("fine");
    handlers.onPointerUp(pointer(130, 1000));
    time.frames(2);
    expect(view.chrome().grid).toBe("none");
  });

  it("does not come back after the release of a drag", () => {
    const { cropper, time, view } = gridRig();
    const handlers = dialHandlers(cropper, {}, () => track);

    handlers.onPointerDown(pointer(100, 0));
    handlers.onPointerMove(pointer(130, 16));
    handlers.onPointerUp(pointer(130, 1000));
    time.frames(2);
    expect(view.chrome().grid).toBe("none");
  });

  it("appears for a dial key and goes with its release", () => {
    const { cropper, time, view } = gridRig();
    const keys = dialHandlers(cropper, {}, () => track);

    keys.onKeyDown(key({ key: "ArrowRight" }));
    expect(view.chrome().grid).toBe("fine");
    keys.onKeyUp(key({ key: "ArrowRight" }));
    time.frames(2);
    expect(view.chrome().grid).toBe("none");
  });

  it("stays off for an area key", () => {
    const { cropper, time, view } = gridRig();
    const keys = areaKeyHandlers(cropper);

    cropper.setRotation(5, { emit: false });
    keys.onKeyDown(key({ key: "0" }));
    time.frames(2);
    expect(view.chrome().grid).toBe("none");
    keys.onKeyUp(key({ key: "0" }));
  });
});

describe("area keys", () => {
  it("resizes by 1% with alt: right and down grow, left and up shrink", () => {
    const { cropper } = setup({ defaultValue: { aspect: 1 } });
    const keys = areaKeyHandlers(cropper);
    const width = (): number => cropper.getValue().size.width;
    const start = width();

    press(keys, { altKey: true, key: "ArrowLeft" });
    expect(width()).toBeCloseTo(start / 1.01, 9);
    press(keys, { altKey: true, key: "ArrowUp" });
    expect(width()).toBeCloseTo(start / 1.01 ** 2, 9);
    press(keys, { altKey: true, key: "ArrowRight" });
    expect(width()).toBeCloseTo(start / 1.01, 9);
    press(keys, { altKey: true, key: "ArrowDown" });
    expect(width()).toBeCloseTo(start, 9);
  });

  it("keeps the centre and a locked ratio while it resizes", () => {
    const { cropper } = setup({ defaultValue: { aspect: 1 } });

    cropper.setZoom(2);
    const keys = areaKeyHandlers(cropper);
    const { center } = cropper.getValue();

    press(keys, { altKey: true, key: "ArrowLeft" });
    press(keys, { altKey: true, key: "ArrowRight" });
    expect(cropper.getValue().center).toStrictEqual(center);
    const crop = cropper.getCropState()?.crop;

    expect(crop?.width).toBeCloseTo(crop?.height ?? 0, 6);
  });

  it("stops growing rather than move the centre at the photo's edge", () => {
    const { cropper } = setup({ defaultValue: { aspect: 1 } });

    cropper.setZoom(2);
    cropper.panBy(1, 1);
    const before = cropper.getValue();

    press(areaKeyHandlers(cropper), { altKey: true, key: "ArrowRight" });
    expect(cropper.getValue().center.x).toBeCloseTo(before.center.x, 9);
    expect(cropper.getValue().center.y).toBeCloseTo(before.center.y, 9);
    expect(cropper.getValue().size.width).toBeCloseTo(before.size.width, 9);
  });

  it("resizes one side of a free crop", () => {
    const { cropper } = setup();

    cropper.setZoom(2);
    const before = cropper.getValue().size;

    press(areaKeyHandlers(cropper), { altKey: true, key: "ArrowLeft" });
    const after = cropper.getValue().size;

    expect(after.width).toBeCloseTo(before.width / 1.01, 9);
    expect(after.height).toBe(before.height);
  });
});

describe("focus loss", () => {
  it("ends a held Area key when focus leaves", () => {
    const { cropper } = setup();
    const keys = areaKeyHandlers(cropper);

    keys.onKeyDown(key({ key: "=" }));
    expect(cropper.getState().interacting).toBe("keyboard");
    keys.onBlur(blur());
    expect(cropper.getState().interacting).toBeNull();
    expect(cropper.begin("pan")).toBeTruthy();
  });

  it("ends a held Zoom key when focus leaves", () => {
    const { cropper } = setup();
    const keys = zoomHandlers(cropper);

    keys.onKeyDown(key({ key: "End" }));
    expect(cropper.getState().interacting).toBe("keyboard");
    keys.onBlur(blur());
    expect(cropper.getState().interacting).toBeNull();
  });

  it("ends a held Dial key when focus leaves", () => {
    const { cropper } = setup();
    const keys = dialHandlers(cropper);

    keys.onKeyDown(key({ key: "ArrowRight" }));
    expect(cropper.getState().interacting).toBe("keyboard");
    keys.onBlur(blur());
    expect(cropper.getState().interacting).toBeNull();
  });
});

const pastTheStop = (cropper: Cropper) => {
  const handlers = dialHandlers(cropper, {}, () => track);

  handlers.onPointerDown(pointer(0, 0));
  handlers.onPointerMove(pointer(30, 8));
  handlers.onPointerMove(pointer(300, 16));
  handlers.onPointerUp(pointer(300, 200));

  return handlers;
};

describe("dial bounce", () => {
  beforeEach(() => {
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("addEventListener", vi.fn<() => void>());
    vi.stubGlobal("removeEventListener", vi.fn<() => void>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops at the limit, overshoots and springs back", () => {
    const { cropper, time } = setup();

    pastTheStop(cropper);
    expect(cropper.getValue().rotation).toBe(45);
    expect(dialState(cropper).overshoot()).toBeGreaterThan(0);
    time.frames(120);
    expect(dialState(cropper).overshoot()).toBe(0);
    expect(cropper.getValue().rotation).toBe(45);
  });

  it("stops a glide when a key lands, and commits once", () => {
    const commit = vi.fn<() => void>();
    const { cropper, time } = setup({ onValueCommit: commit });
    const handlers = dialHandlers(cropper, {}, () => track);

    handlers.onPointerDown(pointer(0, 0));

    for (let i = 1; i <= 8; i += 1) {
      handlers.onPointerMove(pointer(15 + i * 15, i * 8));
    }

    handlers.onPointerUp(pointer(135, 66));
    time.frames(3);
    expect(commit).not.toHaveBeenCalled();
    handlers.onKeyDown(key({ key: "ArrowLeft" }));
    const held = cropper.getValue().rotation;

    time.frames(5);
    expect(cropper.getValue().rotation).toBe(held);
    handlers.onKeyUp(key({ key: "ArrowLeft" }));
    time.frames(2);
    expect(commit).toHaveBeenCalledOnce();
    expect(cropper.getState().interacting).toBeNull();
    expect(cropper.getState().settling).toBeFalsy();
  });

  it("a press on the zoom track during a glide takes hold at once", () => {
    const { cropper, time } = setup();
    const handlers = dialHandlers(cropper, {}, () => track);
    const box = cast(
      {
        getBoundingClientRect: () => ({ left: 0, width: 361 }),
        getClientRects: () => [{}],
        ownerDocument: {},
        setPointerCapture: () => {},
      },
      isElement
    );
    const zoom = zoomHandlers(cropper, {}, () => box);

    handlers.onPointerDown(pointer(0, 0));

    for (let i = 1; i <= 8; i += 1) {
      handlers.onPointerMove(pointer(15 + i * 15, i * 8));
    }

    handlers.onPointerUp(pointer(135, 66));
    time.frames(3);
    expect(cropper.getState().interacting).toBe("dial");
    const held = cropper.getValue().rotation;

    zoom.onPointerDown(pointer(180, 90));
    expect(cropper.getState().interacting).toBe("zoom-control");
    expect(cropper.getZoom()).toBeGreaterThan(1.5);
    time.frames(5);
    expect(cropper.getValue().rotation).toBe(held);
    zoom.onPointerUp(pointer(180, 90));
  });

  it("an area key during a glide acts and keeps the key from the page", () => {
    const { cropper, time } = setup();
    const handlers = dialHandlers(cropper, {}, () => track);
    const keys = areaKeyHandlers(cropper);

    cropper.setZoom(2);
    handlers.onPointerDown(pointer(0, 0));

    for (let i = 1; i <= 8; i += 1) {
      handlers.onPointerMove(pointer(15 + i * 15, i * 8));
    }

    handlers.onPointerUp(pointer(135, 66));
    time.frames(3);
    const { x } = cropper.getValue().center;
    const prevent = vi.fn<() => void>();

    keys.onKeyDown(
      cast(
        {
          altKey: false,
          key: "ArrowRight",
          preventDefault: prevent,
          shiftKey: false,
        },
        isKey
      )
    );

    expect(prevent).toHaveBeenCalledOnce();
    expect(cropper.getState().interacting).toBe("keyboard");
    expect(cropper.getValue().center.x).not.toBe(x);
    keys.onKeyUp(key({ key: "ArrowRight" }));
  });

  it("still springs back when a key lands during the bounce", () => {
    const { cropper, time } = setup();
    const keys = pastTheStop(cropper);

    time.frames(2);
    expect(dialState(cropper).overshoot()).toBeGreaterThan(0);
    keys.onKeyDown(key({ key: "ArrowLeft" }));
    keys.onKeyUp(key({ key: "ArrowLeft" }));
    time.frames(120);
    expect(dialState(cropper).overshoot()).toBe(0);
    expect(cropper.getValue().rotation).toBe(44);
  });
});

describe("pure control helpers", () => {
  it("puts zoom on a log scale, so 2x sits 26% along a 15x track", () => {
    expect(zoomProgress(2)).toBeCloseTo(0.256, 3);
    expect(zoomAt(zoomProgress(2))).toBeCloseTo(2, 9);
  });

  it("clamps the zoom track at both ends", () => {
    expect([1, 0.5, 15, 30].map((zoom) => zoomProgress(zoom))).toStrictEqual([
      0, 0, 1, 1,
    ]);

    expect(zoomProgress(2, 1)).toBe(0);
    expect([zoomAt(-1), zoomAt(2)]).toStrictEqual([1, 15]);
  });

  it("marks the ruler's majors, zero and faded ends", () => {
    expect(tickData(0)).toStrictEqual({ fade: 0, major: true, zero: false });
    expect(tickData(20)).toStrictEqual({ fade: null, major: true, zero: true });
    expect(tickData(21).major).toBeFalsy();
    expect([2, 3, 40].map((i) => tickData(i).fade)).toStrictEqual([2, null, 0]);
  });
});
