import { afterEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import {
  areaKeyHandlers,
  bindArea,
  bindDial,
  bindHandle,
  bindViewport,
  dialHandlers,
  dialState,
  exportImage,
  loadImage,
  viewOf,
  zoomHandlers,
} from "../../src/dom";
import { bindPointers } from "../../src/dom/input";
import { fakeClock } from "../fake-clock";

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const cleanups: (() => void)[] = [];

const mount = () => {
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const area = document.createElement("div");
  const handle = document.createElement("div");
  area.append(handle);
  viewport.append(area);
  document.body.append(viewport);
  const cropper = createCropper({ image: { height: 3000, width: 4000 } });
  const off = [
    bindViewport(cropper, viewport),
    bindArea(cropper, area),
    bindHandle(cropper, handle, "bottom-right"),
  ];
  cleanups.push(() => {
    for (const stop of off) {
      stop();
    }
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
  });
  return { cropper, handle, viewport };
};

const pointer = (target: Element, type: string, x: number, y: number) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
    })
  );

describe("review regressions in the browser", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("keeps a resize going when the wheel turns", async () => {
    const { cropper, handle, viewport } = mount();
    await frames();
    const box = handle.getBoundingClientRect();
    pointer(handle, "pointerdown", box.x, box.y);
    viewport.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 30 })
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
    expect(cropper.getState().interacting).toBe("resize");
    pointer(handle, "pointerup", box.x, box.y);
  });

  it("cancels a resize with Escape", async () => {
    const { cropper, handle } = mount();
    await frames();
    const before = cropper.getValue();
    const box = handle.getBoundingClientRect();
    pointer(handle, "pointerdown", box.x, box.y);
    pointer(handle, "pointermove", box.x - 80, box.y - 60);
    expect(cropper.getValue()).not.toBe(before);
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
    );
    expect(cropper.getValue()).toStrictEqual(before);
    expect(cropper.getState().interacting).toBeNull();
  });

  it("exports a photo whose corners are transparent", async () => {
    const canvas = new OffscreenCanvas(40, 40);
    const context = canvas.getContext("2d");
    context?.fillRect(15, 15, 10, 10);
    const image = await loadImage(
      await canvas.convertToBlob({ type: "image/png" })
    );
    const result = await exportImage(createCropper({ image }), image, {
      type: "image/png",
    });
    expect(result.width).toBe(40);
  });
});

const rig = (options: Parameters<typeof bindViewport>[2] = {}) => {
  const time = fakeClock();
  const viewport = document.createElement("div");
  viewport.style.cssText =
    "position:relative;width:400px;height:300px;cursor:grab;";
  const area = document.createElement("div");
  const handle = document.createElement("div");
  handle.style.cssText = "width:20px;height:20px;cursor:ew-resize;";
  area.append(handle);
  viewport.append(area);
  const dial = document.createElement("div");
  dial.style.cssText = "width:300px;height:40px;cursor:grab;";
  const zoom = document.createElement("div");
  zoom.style.cssText = "width:300px;height:20px;";
  document.body.append(viewport, dial, zoom);
  const commits: string[] = [];
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 3000, width: 4000 },
    onValueCommit: (_, details) => {
      commits.push(details.reason);
    },
  });
  const zoomers = zoomHandlers(cropper, {}, () => zoom);
  const off = [
    bindViewport(cropper, viewport, options),
    bindArea(cropper, area),
    bindHandle(cropper, handle, "bottom-right"),
    bindDial(cropper, dial),
    bindPointers(zoom, zoomers),
    zoomers.release,
  ];
  const unbind = () => {
    for (const stop of off.splice(0)) {
      stop();
    }
  };
  cleanups.push(() => {
    unbind();
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
    dial.remove();
    zoom.remove();
  });
  time.frames(2);
  return { commits, cropper, dial, handle, time, unbind, viewport, zoom };
};

type Rig = ReturnType<typeof rig>;

const fire = (
  target: EventTarget,
  type: string,
  x: number,
  y = 10,
  init: PointerEventInit = {}
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      ...init,
    })
  );

const safari = (
  target: EventTarget,
  type: string,
  fields: { rotation?: number; scale?: number } = {}
): boolean => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  return (
    target.dispatchEvent(
      Object.assign(event, {
        clientX: 200,
        clientY: 150,
        rotation: 0,
        scale: 1,
        ...fields,
      })
    ) && !event.defaultPrevented
  );
};

const wheel = (target: EventTarget, init: WheelEventInit): WheelEvent => {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const hideTab = () => {
  const spy = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  spy.mockRestore();
};

const blurWindow = () => {
  window.dispatchEvent(new Event("blur"));
};

const pressEscape = () =>
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
  );

const parts: [string, (r: Rig) => HTMLElement, string][] = [
  ["handle", (r) => r.handle, "resize"],
  ["dial", (r) => r.dial, "dial"],
  ["zoom", (r) => r.zoom, "zoom-control"],
  ["photo", (r) => r.viewport, "pan"],
];

const drag = (r: Rig, part: HTMLElement): void => {
  r.cropper.setZoom(2, { emit: false });
  r.time.frames(1);
  fire(part, "pointerdown", 100);
  fire(part, "pointermove", 160, 40);
  r.time.frames(1);
};

const stamped = (type: string, clientX: number, timeStamp: number) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    buttons: type === "pointerup" ? 0 : 1,
    clientX,
    composed: true,
    pointerId: 2,
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
};

const throwDial = (r: Rig): void => {
  const handlers = dialHandlers(r.cropper);
  handlers.onPointerDown(stamped("pointerdown", 100, 0));
  for (let i = 1; i <= 5; i += 1) {
    handlers.onPointerMove(stamped("pointermove", 100 + i * 15, i * 16));
  }
  handlers.onPointerUp(stamped("pointerup", 175, 80));
  r.time.frames(2);
};

describe("gesture lifetime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("a binder cleanup mid-drag ends the gesture and frees the page", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const sheets = document.adoptedStyleSheets.length;
      drag(r, pick(r));
      r.unbind();
      expect(r.cropper.getState().interacting).toBeNull();
      expect(document.adoptedStyleSheets.length).toBeLessThanOrEqual(sheets);
      expect(dialState(r.cropper).dragging()).toBeFalsy();
      const escape = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      });
      document.body.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBeFalsy();
      expect(r.cropper.begin("pan", undefined, {})).toBeTruthy();
    }
  });

  it("a held key ends when its handlers are released", () => {
    const r = rig();
    const keys = areaKeyHandlers(r.cropper);
    keys.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(r.cropper.getState().interacting).toBe("keyboard");
    keys.release();
    expect(r.cropper.getState().interacting).toBeNull();
  });

  it("window blur and a hidden tab end a drag on every part", () => {
    for (const lose of [blurWindow, hideTab]) {
      for (const [, pick] of parts) {
        const r = rig();
        const part = pick(r);
        drag(r, part);
        lose();
        const held = r.cropper.getValue();
        expect(r.cropper.getState().interacting).toBeNull();
        fire(part, "pointermove", 220, 80);
        expect(r.cropper.getValue()).toBe(held);
      }
    }
  });

  it("stop mid-drag ends every part, and later moves change nothing", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const part = pick(r);
      drag(r, part);
      r.cropper.stop();
      const held = r.cropper.getValue();
      fire(part, "pointermove", 220, 80);
      fire(part, "pointerup", 220, 80);
      r.time.frames(5);
      expect(r.cropper.getValue()).toBe(held);
      expect(dialState(r.cropper).dragging()).toBeFalsy();
      expect(r.cropper.getState().settling).toBeFalsy();
    }
  });

  it("a mouse move with no button held ends the drag instead of moving", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const part = pick(r);
      drag(r, part);
      const held = r.cropper.getValue();
      fire(part, "pointermove", 220, 80, { buttons: 0 });
      expect(r.cropper.getState().interacting).toBeNull();
      expect(r.cropper.getValue()).toBe(held);
    }
  });

  it("ctrl and press starts nothing on a mac, and still starts elsewhere", () => {
    const platform = vi.spyOn(navigator, "platform", "get");
    for (const [, pick, reason] of parts) {
      const r = rig();
      platform.mockReturnValue("MacIntel");
      fire(pick(r), "pointerdown", 100, 10, { ctrlKey: true });
      expect(r.cropper.getState().interacting).toBeNull();
      platform.mockReturnValue("Win32");
      fire(pick(r), "pointerdown", 100, 10, { ctrlKey: true });
      expect(r.cropper.getState().interacting).toBe(reason);
    }
  });

  it("a part hidden mid-drag keeps the value it had and commits it", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const part = pick(r);
      drag(r, part);
      const held = r.cropper.getValue();
      part.style.display = "none";
      fire(part, "pointermove", 20, 200);
      expect(r.cropper.getValue()).toBe(held);
      expect(r.cropper.getState().interacting).toBeNull();
      part.style.display = "";
    }
  });

  it("a release on another element ends a drag whose capture was taken", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const part = pick(r);
      drag(r, part);
      fire(document.body, "pointerup", 160, 40);
      expect(r.cropper.getState().interacting).toBeNull();
      const held = r.cropper.getValue();
      fire(part, "pointermove", 220, 80, { buttons: 0 });
      expect(r.cropper.getValue()).toBe(held);
    }
  });

  it("a press on a child control starts no pan and keeps its own click", () => {
    const r = rig();
    const button = document.createElement("button");
    r.viewport.append(button);
    fire(button, "pointerdown", 50);
    expect(r.cropper.getState().interacting).toBeNull();
    fire(r.viewport, "pointerdown", 50);
    expect(r.cropper.getState().interacting).toBe("pan");
    fire(r.viewport, "pointerup", 50);
  });

  it("a press inside a nested cropper leaves the outer cropper alone", () => {
    const outer = rig();
    const inner = rig();
    outer.viewport.append(inner.viewport, inner.dial, inner.zoom);
    for (const [, pick, reason] of parts) {
      fire(pick(inner), "pointerdown", 50);
      expect(outer.cropper.getState().interacting).toBeNull();
      expect(inner.cropper.getState().interacting).toBe(reason);
      fire(pick(inner), "pointerup", 50);
      inner.time.frames(1);
    }
  });

  it("a touch pan holds no page-wide cursor, a mouse pan does", () => {
    for (const [pointerType, added] of [
      ["touch", 0],
      ["mouse", 1],
    ] as const) {
      const r = rig();
      const sheets = document.adoptedStyleSheets.length;
      fire(r.viewport, "pointerdown", 50, 10, { pointerType });
      expect(document.adoptedStyleSheets.length - sheets).toBe(added);
      fire(r.viewport, "pointerup", 50, 10, { pointerType });
      const press = r.handle.getBoundingClientRect();
      fire(r.handle, "pointerdown", press.x, press.y, { pointerType });
      expect(document.adoptedStyleSheets.length - sheets).toBe(added);
      fire(r.handle, "pointerup", press.x, press.y, { pointerType });
    }
  });
});

describe("wheel and pinch on the photo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("a press right after the wheel keeps its gesture past the idle timer", async () => {
    const r = rig();
    r.cropper.setZoom(2, { emit: false });
    r.time.frames(1);
    wheel(r.viewport, { deltaY: 30 });
    fire(r.viewport, "pointerdown", 50);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    expect(r.cropper.getState().interacting).toBe("pan");
    fire(r.viewport, "pointerup", 50);
  });

  it("a safari pinch right after the wheel outlives the idle timer", async () => {
    const r = rig();
    r.cropper.setZoom(2, { emit: false });
    r.time.frames(1);
    wheel(r.viewport, { deltaY: 30 });
    safari(r.viewport, "gesturestart");
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    expect(r.cropper.getState().interacting).toBe("pinch");
    safari(r.viewport, "gestureend");
  });

  it("ctrl and wheel past a limit does not move the crop", () => {
    const r = rig();
    r.cropper.setOptions({ maxZoom: 4 });
    r.cropper.setZoom(4);
    r.time.frames(1);
    const { x, y } = r.cropper.getValue().center;
    for (let i = 0; i < 4; i += 1) {
      wheel(r.viewport, {
        clientX: 390,
        clientY: 290,
        ctrlKey: true,
        deltaY: -50,
      });
      r.time.frames(1);
    }
    expect(r.cropper.getValue().center.x).toBeCloseTo(x, 9);
    expect(r.cropper.getValue().center.y).toBeCloseTo(y, 9);
  });

  it("a pinch out at zoom 1 on a square crop keeps the centre", () => {
    const r = rig();
    r.cropper.setAspect(1, { emit: false });
    r.time.frames(1);
    wheel(r.viewport, {
      clientX: 390,
      clientY: 150,
      ctrlKey: true,
      deltaY: 50,
    });
    expect(r.cropper.getValue().center.x).toBeCloseTo(0.5, 9);
  });

  it("a twist back through its start angle never jumps", () => {
    const r = rig();
    safari(r.viewport, "gesturestart");
    let last = 0;
    let worst = 0;
    for (const rotation of [2, 6, 8, 6, 3, 1, 0.5, -0.5, -1, -3, -6, -8]) {
      safari(r.viewport, "gesturechange", { rotation });
      const now = r.cropper.getValue().rotation;
      worst = Math.max(worst, Math.abs(now - last));
      last = now;
    }
    expect(worst).toBeLessThanOrEqual(3);
    safari(r.viewport, "gestureend");
  });

  it("two fingers turning past 180 degrees stay at the limit", () => {
    const r = rig();
    const finger = (id: number, type: string, angle: number) => {
      const radians = (angle * Math.PI) / 180;
      const side = id === 1 ? -1 : 1;
      fire(
        r.viewport,
        type,
        200 + side * 80 * Math.cos(radians),
        150 + side * 80 * Math.sin(radians),
        { pointerId: id, pointerType: "touch" }
      );
    };
    finger(1, "pointerdown", 0);
    finger(2, "pointerdown", 0);
    for (let angle = 10; angle <= 200; angle += 10) {
      finger(1, "pointermove", angle);
      finger(2, "pointermove", angle);
    }
    expect(r.cropper.getValue().rotation).toBe(45);
    finger(1, "pointerup", 200);
    finger(2, "pointerup", 200);
  });

  it("the finger left after a pinch reports a pan", () => {
    const r = rig();
    r.cropper.setZoom(2, { emit: false });
    fire(r.viewport, "pointerdown", 100, 100, {
      pointerId: 1,
      pointerType: "touch",
    });
    fire(r.viewport, "pointerdown", 200, 100, {
      pointerId: 2,
      pointerType: "touch",
    });
    expect(r.cropper.getState().interacting).toBe("pinch");
    fire(r.viewport, "pointerup", 200, 100, {
      pointerId: 2,
      pointerType: "touch",
    });
    fire(r.viewport, "pointermove", 110, 100, {
      pointerId: 1,
      pointerType: "touch",
    });
    expect(r.cropper.getState().interacting).toBe("pan");
    fire(r.viewport, "pointerup", 110, 100, {
      pointerId: 1,
      pointerType: "touch",
    });
  });

  it("a second finger lifting keeps the rubber band where it was", () => {
    const r = rig();
    const view = viewOf(r.cropper);
    const touch = { pointerType: "touch" };
    fire(r.viewport, "pointerdown", 50, 150, { pointerId: 1, ...touch });
    fire(r.viewport, "pointermove", 350, 150, { pointerId: 1, ...touch });
    const shift = view.overscroll().x;
    expect(shift).toBeGreaterThan(50);
    fire(r.viewport, "pointerdown", 200, 150, { pointerId: 2, ...touch });
    fire(r.viewport, "pointerup", 200, 150, { pointerId: 2, ...touch });
    fire(r.viewport, "pointermove", 351, 150, { pointerId: 1, ...touch });
    expect(Math.abs(view.overscroll().x - shift)).toBeLessThan(2);
    fire(r.viewport, "pointerup", 351, 150, { pointerId: 1, ...touch });
  });

  it("a wheel zoom reports the wheel on change and on commit", () => {
    const r = rig();
    const reasons: string[] = [];
    r.cropper.on("change", (_, details) => {
      reasons.push(details.reason);
    });
    wheel(r.viewport, { ctrlKey: true, deltaY: -50 });
    r.time.frames(1);
    expect(reasons).toStrictEqual(["wheel"]);
  });

  it("a disabled wheel zoom leaves the page its scroll, and blocks page zoom", () => {
    const r = rig({ wheel: "zoom" });
    r.cropper.setOptions({ disabled: true });
    expect(wheel(r.viewport, { deltaY: 40 }).defaultPrevented).toBeFalsy();
    expect(
      wheel(r.viewport, { ctrlKey: true, deltaY: 40 }).defaultPrevented
    ).toBeTruthy();
  });

  it("a sideways wheel in zoom mode stays with the page", () => {
    const r = rig({ wheel: "zoom" });
    expect(wheel(r.viewport, { deltaX: 40 }).defaultPrevented).toBeFalsy();
    expect(r.cropper.getState().interacting).toBeNull();
    expect(
      wheel(r.viewport, { ctrlKey: true, deltaX: 40 }).defaultPrevented
    ).toBeTruthy();
  });

  it("ctrl and wheel during a drag stays away from the browser", () => {
    const r = rig();
    fire(r.viewport, "pointerdown", 50);
    expect(
      wheel(r.viewport, { ctrlKey: true, deltaY: 40 }).defaultPrevented
    ).toBeTruthy();
    fire(r.viewport, "pointerup", 50);
  });

  it("safari gestures stay with the page on an inert cropper", () => {
    const r = rig();
    r.cropper.setOptions({ disabled: true });
    expect(safari(r.viewport, "gesturestart")).toBeTruthy();
    expect(safari(r.viewport, "gesturechange")).toBeTruthy();
    expect(safari(r.viewport, "gestureend")).toBeTruthy();
    r.cropper.setOptions({ disabled: false });
    r.cropper.setImage(null);
    expect(safari(r.viewport, "gesturestart")).toBeTruthy();
    r.cropper.setImage({ height: 3000, width: 4000 });
    fire(r.viewport, "pointerdown", 50);
    expect(safari(r.viewport, "gesturestart")).toBeFalsy();
    fire(r.viewport, "pointerup", 50);
  });

  it("a press takes over from a safari gesture", () => {
    const r = rig();
    safari(r.viewport, "gesturestart");
    safari(r.viewport, "gesturechange", { scale: 2 });
    fire(r.viewport, "pointerdown", 100, 100);
    const held = r.cropper.getValue();
    safari(r.viewport, "gesturechange", { scale: 1.2 });
    expect(r.cropper.getValue()).toBe(held);
    fire(r.viewport, "pointerup", 100, 100);
  });

  it("one ctrl wheel notch zooms the same at any browser zoom", () => {
    const ratios = [1, 0.9, 0.800000011920929, 1.1, 1.5].map((dpr) => {
      vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(dpr);
      const r = rig();
      wheel(r.viewport, { ctrlKey: true, deltaY: -100 / dpr });
      return r.cropper.getZoom();
    });
    for (const ratio of ratios) {
      expect(ratio).toBeCloseTo(ratios[0] ?? 0, 6);
    }
  });

  it("a drag on a cropper disabled mid-drag does not rubber-band", () => {
    const r = rig();
    fire(r.viewport, "pointerdown", 50, 150);
    r.cropper.setOptions({ disabled: true });
    fire(r.viewport, "pointermove", 250, 150);
    expect(viewOf(r.cropper).overscroll().x).toBe(0);
    fire(r.viewport, "pointerup", 250, 150);
  });
});

describe("writes during a held gesture", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("a flip, a turn and a reset mid-pan survive the next move", () => {
    const r = rig();
    r.cropper.setZoom(2, { emit: false });
    r.time.frames(1);
    fire(r.viewport, "pointerdown", 100, 100);
    fire(r.viewport, "pointermove", 110, 100);
    r.cropper.flip("x");
    fire(r.viewport, "pointermove", 120, 100);
    expect(r.cropper.getValue().mirrored).toBeTruthy();
    r.cropper.rotate90("ccw");
    fire(r.viewport, "pointermove", 125, 100);
    expect(r.cropper.getValue().quarterTurns).toBe(3);
    r.cropper.reset();
    r.time.frames(1);
    fire(r.viewport, "pointermove", 126, 100);
    expect(r.cropper.getValue().size.width).toBeCloseTo(1, 6);
    fire(r.viewport, "pointerup", 126, 100);
  });

  it("a canceled change mid-pan does not make the photo slip from the finger", () => {
    const r = rig();
    r.cropper.setZoom(2, { emit: false });
    r.time.frames(1);
    r.cropper.on("change", (next, details) => {
      if (next.center.x < 0.45) {
        details.cancel();
      }
    });
    fire(r.viewport, "pointerdown", 100, 100);
    fire(r.viewport, "pointermove", 180, 100);
    r.time.frames(1);
    fire(r.viewport, "pointermove", 100, 100);
    r.time.frames(1);
    expect(r.cropper.getValue().center.x).toBeCloseTo(0.5, 6);
    fire(r.viewport, "pointerup", 100, 100);
  });

  it("a new photo under a held pan, handle or dial stays the new photo", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const part = pick(r);
      drag(r, part);
      r.cropper.setImage({ height: 900, width: 300 });
      fire(part, "pointermove", 170, 45);
      fire(part, "pointerup", 170, 45);
      r.time.frames(2);
      expect(r.cropper.getCropState()?.image.width).toBe(300);
      const plan = r.cropper.getPixelCrop();
      expect(plan?.pixelRect?.width ?? 0).toBeLessThanOrEqual(300);
      expect(r.cropper.getValue().size.width).toBeGreaterThan(0.2);
    }
  });

  it("escape after a swap keeps the new photo, and after detach stays empty", () => {
    const r = rig();
    drag(r, r.viewport);
    r.cropper.setImage({ height: 900, width: 300 });
    pressEscape();
    expect(r.cropper.getCropState()?.image.width).toBe(300);
    drag(r, r.viewport);
    r.cropper.setImage(null);
    pressEscape();
    expect(r.cropper.getState().ready).toBeFalsy();
  });

  it("a held handle drops the old photo's placement when a new photo lands", () => {
    const r = rig();
    drag(r, r.handle);
    r.cropper.setImage({ height: 900, width: 300 });
    r.time.frames(1);
    const rect = viewOf(r.cropper).frame()?.rect;
    expect(rect?.height).toBeLessThanOrEqual(300);
    fire(r.handle, "pointerup", 160, 40);
  });

  it("a handle released just before a swap does not blow up the new photo", () => {
    const r = rig();
    fire(r.handle, "pointerdown", 10);
    fire(r.handle, "pointermove", 0);
    fire(r.handle, "pointerup", 0);
    r.cropper.setImage({ height: 3000, width: 1000 });
    r.time.frames(1);
    expect(viewOf(r.cropper).frame()?.rect.height).toBeLessThanOrEqual(300);
  });

  it("a state from the old photo is dropped", () => {
    const r = rig();
    const old = r.cropper.getCropState();
    r.cropper.setImage({ height: 900, width: 300 });
    const fresh = r.cropper.getCropState();
    if (old) {
      r.cropper.setCropState(old);
    }
    expect(r.cropper.getCropState()).toBe(fresh);
  });

  it("a handle tap that moved nothing runs no recentre", async () => {
    const r = rig();
    viewOf(r.cropper).setOptions({ recentreDelay: 0 });
    fire(r.handle, "pointerdown", 10);
    fire(r.handle, "pointerup", 10);
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(viewOf(r.cropper).chrome().transition).toBeNull();
  });

  it("a photo removed under a held handle ends the drag and frees the page", () => {
    const r = rig();
    const sheets = document.adoptedStyleSheets.length;
    fire(r.handle, "pointerdown", 10);
    fire(r.handle, "pointermove", 0);
    r.cropper.setImage(null);
    fire(r.handle, "pointermove", 5);
    expect(r.cropper.getState().interacting).toBeNull();
    expect(document.adoptedStyleSheets).toHaveLength(sheets);
    fire(r.handle, "pointerup", 5);
    r.cropper.setImage({ height: 3000, width: 4000 });
    r.time.frames(1);
    fire(r.viewport, "pointerdown", 100);
    expect(r.cropper.getState().interacting).toBe("pan");
    fire(r.viewport, "pointerup", 100);
  });

  it("hiding the tab leaves an idle cropper and its running tasks alone", () => {
    const r = rig();
    const events: string[] = [];
    for (const type of ["stop", "frame"] as const) {
      r.cropper.on(type, () => {
        events.push(type);
      });
    }
    hideTab();
    expect(events).toStrictEqual([]);
    let calls = 0;
    r.cropper.run(() => {
      calls += 1;
      return calls < 5;
    }, false);
    r.time.frames(2);
    hideTab();
    r.time.frames(3);
    expect(calls).toBe(5);
  });

  it("a throw on the dial finishes through a hidden tab and reports settle", () => {
    const r = rig();
    const settle = vi.fn<() => void>();
    r.cropper.on("settle", settle);
    throwDial(r);
    expect(r.cropper.getState().interacting).toBe("dial");
    const at = r.cropper.getValue().rotation;
    hideTab();
    expect(r.cropper.getState().interacting).toBe("dial");
    r.time.frames(240);
    expect(r.cropper.getState().interacting).toBeNull();
    expect(r.cropper.getValue().rotation).toBeGreaterThan(at);
    expect(settle).toHaveBeenCalledOnce();
  });

  it("a meta release ends a held key, and another modifier leaves it held", () => {
    const r = rig();
    const handlers = [
      areaKeyHandlers(r.cropper),
      dialHandlers(r.cropper),
      zoomHandlers(r.cropper),
    ];
    for (const keys of handlers) {
      keys.onKeyDown(
        new KeyboardEvent("keydown", { code: "ArrowUp", key: "ArrowUp" })
      );
      keys.onKeyDown(
        new KeyboardEvent("keydown", {
          code: "MetaLeft",
          key: "Meta",
          metaKey: true,
        })
      );
      keys.onKeyUp(
        new KeyboardEvent("keyup", { code: "ShiftLeft", key: "Shift" })
      );
      expect(r.cropper.getState().interacting).toBe("keyboard");
      keys.onKeyUp(
        new KeyboardEvent("keyup", { code: "MetaLeft", key: "Meta" })
      );
      expect(r.cropper.getState().interacting).toBeNull();
      r.time.frames(1);
    }
  });
});
