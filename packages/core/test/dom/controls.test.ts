import { describe, expect, it, vi } from "vitest";

import type { Cropper, CropperOptions } from "../../src";
import {
  areaKeyHandlers,
  zoomAt,
  zoomHandlers,
  zoomProgress,
} from "../../src/dom/controls";
import { dialHandlers } from "../../src/dom/dial";
import {
  cast,
  dialTrack,
  isObject,
  key,
  laidOut,
  pointer as fakePointer,
  setup as rig,
  stubDom,
} from "../cropper-fixture";
import type { KeyInit } from "../cropper-fixture";

const isFocus = (value: unknown): value is FocusEvent => isObject(value);
const isElement = (value: unknown): value is Element => isObject(value);
const isKey = (value: unknown): value is KeyboardEvent => isObject(value);

const blur = (): FocusEvent => cast({}, isFocus);

const pointer = (clientX: number, timeStamp: number): PointerEvent =>
  fakePointer(clientX, timeStamp, { pointerType: "touch" });

const track = dialTrack();

const setup = (options: CropperOptions = {}) =>
  rig({ image: { height: 300, width: 400 }, ...options });

const press = (
  handlers: ReturnType<typeof areaKeyHandlers>,
  init: KeyInit
): void => {
  handlers.onKeyDown(key(init));
  handlers.onKeyUp(key(init));
};

const glide = (cropper: Cropper) => {
  const handlers = dialHandlers(cropper, {}, () => track);

  handlers.onPointerDown(pointer(0, 0));

  for (let i = 1; i <= 8; i += 1) {
    handlers.onPointerMove(pointer(15 + i * 15, i * 8));
  }

  handlers.onPointerUp(pointer(135, 66));

  return handlers;
};

describe("the fine grid", () => {
  stubDom();

  it("stays off on a still press, appears past the slop and goes on release", () => {
    const { cropper, time, view } = laidOut();
    const handlers = dialHandlers(cropper, {}, () => track);

    handlers.onPointerDown(pointer(100, 0));
    time.frames(70);
    expect(view.chrome().grid).toBe("none");
    expect(view.chrome().active).toBeTruthy();
    handlers.onPointerMove(pointer(105, 1208));
    time.frame();
    expect(view.chrome().grid).toBe("none");
    handlers.onPointerMove(pointer(130, 1216));
    time.frame();
    expect(view.chrome().grid).toBe("fine");
    handlers.onPointerUp(pointer(130, 2200));
    time.frames(2);
    expect(view.chrome().grid).toBe("none");
  });

  it.each([
    ["a key that turns", 0, "ArrowRight", "fine"],
    ["0 at 0°", 0, "0", "none"],
    ["a key at the limit", 45, "ArrowRight", "none"],
  ])("shows %s on the dial as %s", (_name, start, name, grid) => {
    const { cropper, time, view } = laidOut();
    const keys = dialHandlers(cropper, {}, () => track);

    cropper.setRotation(Math.min(start, cropper.getRotationLimit()), {
      emit: false,
    });

    keys.onKeyDown(key({ key: name }));
    expect(view.chrome().grid).toBe(grid);
    keys.onKeyUp(key({ key: name }));
    time.frames(2);
    expect(view.chrome().grid).toBe("none");
  });

  it("stays off for an area key", () => {
    const { cropper, time, view } = laidOut();
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

    const floor = laidOut(
      {
        defaultValue: { aspect: 1 },
        image: { height: 3000, width: 4000 },
        minSize: { height: 512, width: 512 },
      },
      {
        dpr: 1,
        height: 1000,
        inset: { bottom: 0, left: 0, right: 0, top: 0 },
        width: 1000,
      }
    );
    const shrink = areaKeyHandlers(floor.cropper);

    for (let i = 0; i < 60; i += 1) {
      press(shrink, { altKey: true, key: "ArrowLeft", shiftKey: true });
      floor.time.frames(3);
    }

    expect(floor.cropper.getCropState()?.crop.width).toBeCloseTo(512, 6);
    expect(floor.cropper.getCropState()?.crop.height).toBeCloseTo(512, 6);
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
});

describe("focus loss", () => {
  it.each([
    ["Area", areaKeyHandlers, "="],
    ["Zoom", zoomHandlers, "End"],
    ["Dial", dialHandlers, "ArrowRight"],
  ] as const)("ends a held %s key when focus leaves", (_name, bind, name) => {
    const { cropper } = setup();
    const keys = bind(cropper);

    keys.onKeyDown(key({ key: name }));
    expect(cropper.getState().interacting).toBe("keyboard");
    keys.onBlur(blur());
    expect(cropper.getState().interacting).toBeNull();
    expect(cropper.begin("pan")).toBeTruthy();
  });
});

describe("a dial glide", () => {
  stubDom();

  it("stops a glide when a key lands, and commits once", () => {
    const { commit, cropper, time } = setup();
    const handlers = glide(cropper);

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
    const box = cast(
      {
        getBoundingClientRect: () => ({ left: 0, width: 361 }),
        getClientRects: () => [{}],
        ownerDocument: {},
        setPointerCapture: () => null,
      },
      isElement
    );
    const zoom = zoomHandlers(cropper, {}, () => box);

    glide(cropper);
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
    const keys = areaKeyHandlers(cropper);

    cropper.setZoom(2);
    glide(cropper);
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
});

describe("the zoom track", () => {
  it("puts zoom on a log scale, so 2x sits 26% along a 15x track, and clamps at both ends", () => {
    expect(zoomProgress(2)).toBeCloseTo(0.256, 3);
    expect(zoomAt(zoomProgress(2))).toBeCloseTo(2, 9);

    expect([1, 0.5, 15, 30].map((zoom) => zoomProgress(zoom))).toStrictEqual([
      0, 0, 1, 1,
    ]);

    expect(zoomProgress(2, 1)).toBe(0);
    expect([zoomAt(-1), zoomAt(2)]).toStrictEqual([1, 15]);
  });
});

describe("zoom keys past the slider's end", () => {
  stubDom();

  it("leave a zoom above the end there until a key moves it down", () => {
    const { cropper } = setup({ image: { height: 3000, width: 4000 } });
    const handlers = zoomHandlers(cropper, { max: 5 });

    const after = (name: string): number => {
      cropper.setZoom(10);
      handlers.onKeyDown(key({ key: name }));
      handlers.onKeyUp(key({ key: name }));

      return cropper.getZoom();
    };

    const up = after("ArrowUp");
    const down = after("ArrowDown");

    expect({
      down: down > 5 && down < 10,
      end: after("End"),
      home: after("Home"),
      up,
    }).toStrictEqual({ down: true, end: 5, home: 1, up: 10 });
  });
});
