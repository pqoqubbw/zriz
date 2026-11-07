import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, server } from "vitest/browser";

import { createCropper } from "../../src";
import type { Clock, Cropper } from "../../src";
import {
  bindArea,
  bindDial,
  bindDialValue,
  bindHandle,
  bindImage,
  bindMask,
  bindPhoto,
  bindState,
  bindViewport,
  dialHandlers,
  dialState,
  handleHandlers,
  setCropShape,
  viewOf,
  viewportController,
  zoomAria,
  zoomHandlers,
} from "../../src/dom";
import type { ViewportOptions } from "../../src/dom";
import { bindPointers } from "../../src/dom/input";
import { cropShapeOf } from "../../src/dom/shape";
import { applyHomography, invertMatrix3 } from "../../src/geometry";
import { PHOTO } from "../cropper-fixture";
import { fakeClock } from "../fake-clock";
import type { FakeClock } from "../fake-clock";

const cleanups: (() => void)[] = [];
let count = 0;

const clean = (): void => {
  for (const cleanup of cleanups.splice(0).toReversed()) {
    cleanup();
  }

  vi.restoreAllMocks();
};

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const near = (actual: number | undefined, expected: number, digits: number) =>
  Math.abs((actual ?? Number.NaN) - expected) < 10 ** -digits / 2;

const until = async (check: () => boolean): Promise<void> => {
  await vi.waitFor(() => {
    if (!check()) {
      throw new Error("still waiting");
    }
  });
};

type Fixture = {
  id: string;
  cropper: Cropper;
  viewport: HTMLElement;
  image: HTMLElement;
  mask: HTMLElement;
  area: HTMLElement;
  handle: HTMLElement;
  commits: number;
};

const mount = (
  width = 400,
  height = 300,
  hidden = false,
  clock?: Clock,
  options: ViewportOptions = {}
): Fixture => {
  count += 1;
  const id = `zriz-${count}`;
  const viewport = document.createElement("div");

  viewport.id = id;
  viewport.style.cssText = `position:relative;width:${width}px;height:${height}px;padding:20px;box-sizing:border-box;overflow:hidden;background:#111;${hidden ? "display:none;" : ""}`;
  const image = document.createElement("div");

  image.style.background = "linear-gradient(45deg,#c33,#33c)";
  const mask = document.createElement("div");

  mask.style.background = "rgb(0 0 0 / 0.5)";
  const area = document.createElement("div");

  area.style.outline = "1px solid white";
  const handle = document.createElement("div");

  handle.dataset.handle = "se";

  handle.style.cssText =
    "position:absolute;right:-12px;bottom:-12px;width:24px;height:24px;background:white;";

  area.append(handle);
  viewport.append(image, mask, area);
  document.body.append(viewport);
  const fixture: Fixture = {
    area,
    commits: 0,
    cropper: createCropper({
      clock,
      image: PHOTO,
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    handle,
    id,
    image,
    mask,
    viewport,
  };
  const { cropper } = fixture;
  const unbind = [
    bindViewport(cropper, viewport, options),
    bindImage(cropper, image),
    bindMask(cropper, mask),
    bindArea(cropper, area),
    bindHandle(cropper, handle, "bottom-right"),
  ];

  cleanups.push(() => {
    for (const off of unbind) {
      off();
    }

    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
  });

  return fixture;
};

const local = (fixture: Fixture, element: HTMLElement): DOMRect => {
  const outer = fixture.viewport.getBoundingClientRect();
  const box = element.getBoundingClientRect();

  return new DOMRect(box.x - outer.x, box.y - outer.y, box.width, box.height);
};

const wheel = (fixture: Fixture, init: WheelEventInit): boolean => {
  const box = fixture.viewport.getBoundingClientRect();

  return fixture.viewport.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: box.x + 200,
      clientY: box.y + 150,
      ...init,
    })
  );
};

const pressers: Record<
  string,
  (cropper: Cropper, element: HTMLElement) => (event: PointerEvent) => void
> = {
  dial: (cropper, element) =>
    dialHandlers(cropper, {}, () => element).onPointerDown,
  handle: (cropper, element) =>
    handleHandlers(cropper, "top-left", () => element).onPointerDown,
  viewport: (cropper, element) => {
    const controller = viewportController(cropper);

    controller.setElement(element);

    cleanups.push(() => {
      controller.destroy();
    });

    return controller.handlers.onPointerDown;
  },
  zoom: (cropper, element) =>
    zoomHandlers(cropper, {}, () => element).onPointerDown,
};

const startsGesture = (part: string, init: PointerEventInit): boolean => {
  const cropper = createCropper({ image: PHOTO });
  const element = document.createElement("div");

  element.style.cssText = "width:400px;height:300px;";
  document.body.append(element);

  cleanups.push(() => {
    cropper.destroy();
    element.remove();
  });

  let started = false;

  cropper.on("gesturestart", () => {
    started = true;
  });

  pressers[part]?.(
    cropper,
    element
  )(
    new PointerEvent("pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      ...init,
    })
  );

  return started;
};

const pointer = (
  fixture: Fixture,
  type: string,
  pointerId: number,
  x: number,
  y: number,
  pointerType = "touch"
): void => {
  const box = fixture.viewport.getBoundingClientRect();

  fixture.viewport.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      buttons: 1,
      clientX: box.x + x,
      clientY: box.y + y,
      pointerId,
      pointerType,
    })
  );
};

const pannedBy = async (init: WheelEventInit): Promise<number> => {
  const fixture = mount();

  fixture.cropper.setZoom(4, { emit: false });
  await frames();
  wheel(fixture, init);

  return fixture.cropper.getValue().center.y;
};

const rig = (options: ViewportOptions = {}) => {
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
  const cropper = createCropper({ clock: time.clock, image: PHOTO });
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

  return { cropper, dial, handle, time, unbind, viewport, zoom };
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

const touch = (pointerId: number) => ({ pointerId, pointerType: "touch" });

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

const wheelOn = (target: EventTarget, init: WheelEventInit): WheelEvent => {
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

const pressEscape = (): KeyboardEvent => {
  const key = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Escape",
  });

  document.body.dispatchEvent(key);

  return key;
};

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

const throwDial = (cropper: Cropper, time: FakeClock): void => {
  const handlers = dialHandlers(cropper);

  handlers.onPointerDown(stamped("pointerdown", 100, 0));

  for (let i = 1; i <= 5; i += 1) {
    handlers.onPointerMove(stamped("pointermove", 100 - i * 15, i * 16));
  }

  handlers.onPointerUp(stamped("pointerup", 25, 80));
  time.frames(2);
};

const centre = (r: Rig) => {
  const rect = viewOf(r.cropper).frame()?.rect;

  return {
    x: (rect?.x ?? 0) + (rect?.width ?? 0) / 2,
    y: (rect?.y ?? 0) + (rect?.height ?? 0) / 2,
  };
};

describe("which presses start a gesture", () => {
  afterEach(clean);

  it.each(["viewport", "zoom"])(
    "takes only the main button on the %s, from any pointer",
    (part) => {
      const others = [
        { button: 2, buttons: 2, pointerType: "mouse" },
        { button: 2, buttons: 2, pointerType: "pen" },
        { button: 5, buttons: 32, pointerType: "pen" },
      ].map((init) => startsGesture(part, init));
      const main = ["mouse", "pen", "touch"].map((pointerType) =>
        startsGesture(part, { button: 0, buttons: 1, pointerType })
      );

      expect({ main, others }).toStrictEqual({
        main: [true, true, true],
        others: [false, false, false],
      });
    }
  );

  it("a press on a child control or from a portal starts no pan", () => {
    const r = rig();
    const button = document.createElement("button");

    r.viewport.append(button);
    fire(button, "pointerdown", 50);
    const control = r.cropper.getState().interacting;

    fire(r.viewport, "pointerdown", 50);
    const photo = r.cropper.getState().interacting;

    fire(r.viewport, "pointerup", 50);
    r.unbind();
    const portal = document.createElement("div");

    document.body.append(portal);
    const controller = viewportController(r.cropper);

    controller.setElement(r.viewport);
    portal.addEventListener("pointerdown", controller.handlers.onPointerDown);

    cleanups.push(() => {
      controller.destroy();
      portal.remove();
    });

    fire(portal, "pointerdown", 50);

    expect({
      control,
      photo,
      portal: r.cropper.getState().interacting,
    }).toStrictEqual({ control: null, photo: "pan", portal: null });
  });

  it("a press that belongs to someone else starts nothing here", () => {
    const platform = vi.spyOn(navigator, "platform", "get");

    for (const [, pick, reason] of parts) {
      const r = rig();

      platform.mockReturnValue("MacIntel");
      fire(pick(r), "pointerdown", 100, 10, { ctrlKey: true });
      const mac = r.cropper.getState().interacting;

      platform.mockReturnValue("Win32");
      fire(pick(r), "pointerdown", 100, 10, { ctrlKey: true });

      expect([mac, r.cropper.getState().interacting]).toStrictEqual([
        null,
        reason,
      ]);
    }

    platform.mockRestore();
    const outer = rig();
    const inner = rig();

    outer.viewport.append(inner.viewport, inner.dial, inner.zoom);

    for (const [, pick, reason] of parts) {
      fire(pick(inner), "pointerdown", 50);

      expect([
        outer.cropper.getState().interacting,
        inner.cropper.getState().interacting,
      ]).toStrictEqual([null, reason]);

      fire(pick(inner), "pointerup", 50);
      inner.time.frames(1);
    }

    const r = rig();
    const ruler = document.createElement("div");

    r.viewport.append(ruler);
    cleanups.push(bindPointers(ruler, dialHandlers(r.cropper)));
    fire(r.viewport, "pointerdown", 100, 100, touch(1));
    fire(ruler, "pointerdown", 200, 100, touch(2));
    expect(r.cropper.getState().interacting).toBe("pan");
    fire(ruler, "pointerup", 200, 100, touch(2));
    fire(r.viewport, "pointerup", 100, 100, touch(1));
  });
});

describe("layout", () => {
  afterEach(clean);

  it("fits the crop inside the padding and covers it with the photo", async () => {
    const fixture = mount();

    await frames();
    const area = local(fixture, fixture.area);
    const image = local(fixture, fixture.image);

    expect({
      bottom: image.y + image.height >= area.y + area.height - 0.01,
      height: near(area.height, 260, 0),
      inside: area.x >= 19.99 && area.x + area.width <= 380.01,
      left: image.x <= area.x + 0.01,
      right: image.x + image.width >= area.x + area.width - 0.01,
      top: image.y <= area.y + 0.01,
      y: near(area.y, 20, 0),
    }).toStrictEqual({
      bottom: true,
      height: true,
      inside: true,
      left: true,
      right: true,
      top: true,
      y: true,
    });
  });

  it.each([
    ["min-width:5000px;min-height:5000px", "photo"],
    ["border:4px solid red;padding:4px", "photo"],
    ["margin:10px", "photo"],
    ["max-height:100%", "page"],
  ])(
    "keeps the photo at its own size and place under %s on the %s",
    async (css, scope) => {
      const fixture = mount();
      const sheet = document.createElement("style");
      const selector = scope === "page" ? "div" : `#${fixture.id}>:first-child`;

      sheet.textContent = `${selector}{${css}}`;
      document.head.append(sheet);

      cleanups.push(() => {
        sheet.remove();
      });

      await frames();
      const { image } = fixture;

      expect([
        image.offsetWidth,
        image.offsetHeight,
        image.clientLeft,
        image.clientTop,
        image.offsetLeft,
        image.offsetTop,
      ]).toStrictEqual([PHOTO.width, PHOTO.height, 0, 0, 0, 0]);
    }
  );

  it("lays out once a hidden viewport is revealed", async () => {
    const fixture = mount(400, 300, true);

    await frames();
    fixture.viewport.style.display = "block";
    await frames(3);
    expect(local(fixture, fixture.area).height).toBeCloseTo(260, 0);
  });

  it("keeps the value through resizes", async () => {
    const fixture = mount();

    fixture.cropper.setValue({
      center: { x: 0.4, y: 0.55 },
      rotation: 6,
      size: { height: 0.5, width: 0.5 },
    });

    await frames();
    const before = fixture.cropper.getValue();

    for (const width of [800, 200, 1600, 800]) {
      fixture.viewport.style.width = `${width}px`;
      await frames(2);
    }

    expect(fixture.cropper.getValue()).toStrictEqual(before);
  });
});

describe("pointer", () => {
  afterEach(clean);

  it("pans with a mouse drag and commits once", async () => {
    const fixture = mount();

    fixture.cropper.setZoom(2, { emit: false });
    await frames();
    const before = fixture.cropper.getValue().center.x;
    const scale = viewOf(fixture.cropper).frame()?.scale ?? 1;

    await commands.drag(`#${fixture.id}`, [
      [200, 150],
      [220, 150],
      [240, 150],
      [250, 150],
    ]);

    await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);
    await frames(3);
    const moved = (before - fixture.cropper.getValue().center.x) * 4000 * scale;

    expect([moved, fixture.commits]).toStrictEqual([expect.closeTo(50, 0), 1]);
  });

  it("a touch pan holds no page-wide cursor, a mouse pan does", () => {
    for (const [pointerType, added] of [
      ["touch", 0],
      ["mouse", 1],
    ] as const) {
      const r = rig();
      const sheets = document.adoptedStyleSheets.length;

      fire(r.viewport, "pointerdown", 50, 10, { pointerType });
      const panning = document.adoptedStyleSheets.length - sheets;

      fire(r.viewport, "pointerup", 50, 10, { pointerType });
      const press = r.handle.getBoundingClientRect();

      fire(r.handle, "pointerdown", press.x, press.y, { pointerType });
      const resizing = document.adoptedStyleSheets.length - sheets;

      fire(r.handle, "pointerup", press.x, press.y, { pointerType });
      expect([panning, resizing]).toStrictEqual([added, added]);
    }
  });

  it("keeps the photo under the finger when the viewport resizes during a pan", async () => {
    const fixture = mount();
    const { cropper, viewport } = fixture;

    cropper.setValue({ size: { height: 0.5, width: 0.5 } });
    const view = viewOf(cropper);

    const screenX = (): number => {
      const frame = view.frame();

      if (!frame) {
        throw new Error("no frame");
      }

      return applyHomography(frame.matrix, { x: 2000, y: 1500 }).x;
    };

    const press = (type: string, clientX: number): void => {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: 1,
          clientX,
          clientY: 150,
          pointerId: 1,
          pointerType: "touch",
        })
      );
    };

    await frames();
    press("pointerdown", 200);
    press("pointermove", 190);
    await frames();
    const scale = view.frame()?.scale;

    viewport.style.width = "240px";
    viewport.style.height = "180px";
    await expect.poll(() => view.frame()?.scale).not.toBe(scale);
    press("pointermove", 180);
    await frames();
    const resized = screenX();

    press("pointermove", 150);
    await frames();
    const moved = screenX() - resized;

    press("pointerup", 150);
    expect(moved).toBeCloseTo(-30, 3);
  });
});

describe("wheel", () => {
  afterEach(clean);

  it("a wheel at the pan limit goes to the page, one that moves the photo stays with the cropper to the edge", async () => {
    const limit = mount();

    await frames();
    const gestures: string[] = [];

    limit.cropper.on("gesturestart", (reason) => {
      gestures.push(reason);
    });

    const passed = Array.from({ length: 5 }, () =>
      wheel(limit, { deltaY: 40 })
    );
    const started = [...gestures];

    await wait(200);
    limit.cropper.setZoom(2, { emit: false });
    await frames();
    const before = limit.cropper.getValue().center.y;
    const zoomedPassed = wheel(limit, { deltaY: 40 });

    expect({
      moved: limit.cropper.getValue().center.y > before,
      passed,
      started,
      zoomedPassed,
    }).toStrictEqual({
      moved: true,
      passed: [true, true, true, true, true],
      started: [],
      zoomedPassed: false,
    });

    const latched = mount();

    latched.cropper.setZoom(2, { emit: false });
    await frames();
    const view = viewOf(latched.cropper);
    const centres: number[] = [];
    const handled = Array.from({ length: 40 }, (_, i) => {
      const result = wheel(latched, { deltaY: i % 2 === 0 ? 40 : 7 });

      centres.push(latched.cropper.getValue().center.y);

      return result;
    });
    const overscroll = view.overscroll();

    await wait(200);

    expect({
      allHandled: handled.every((result) => !result),
      interacting: latched.cropper.getState().interacting,
      monotone: centres.every((y, i) => i === 0 || y >= (centres[i - 1] ?? 0)),
      overscroll,
    }).toStrictEqual({
      allHandled: true,
      interacting: null,
      monotone: true,
      overscroll: { x: 0, y: 0 },
    });
  });

  it.each([
    [
      "a trackpad flick with momentum",
      (fixture: Fixture, time: FakeClock) => {
        for (let i = 0; i < 6; i += 1) {
          wheel(fixture, { deltaY: 25 });
          time.frame();
        }

        for (let delta = 30; delta > 0.5; delta *= 0.94) {
          wheel(fixture, { deltaY: delta });
          time.frame();
        }
      },
    ],
    [
      "mouse wheel notches",
      (fixture: Fixture, time: FakeClock) => {
        for (let i = 0; i < 6; i += 1) {
          wheel(fixture, { deltaY: 100 });
          time.frames(4);
        }
      },
    ],
  ])(
    "%s on a shrunk crop stop at the edge without overscroll",
    async (_, drive) => {
      const time = fakeClock();
      const fixture = mount(400, 300, false, time.clock);

      await frames();
      time.frames(2);
      const outer = fixture.viewport.getBoundingClientRect();
      const area = fixture.area.getBoundingClientRect();
      const x = area.right - outer.left;
      const y = area.bottom - outer.top;

      await commands.drag(`#${fixture.id}`, [
        [x, y],
        [x - 60, y - 40],
        [x - 120, y - 90],
      ]);

      await frames(1);
      time.frames(2);
      const view = viewOf(fixture.cropper);
      let peak = 0;
      const off = view.onFrame(() => {
        peak = Math.max(
          peak,
          Math.hypot(view.overscroll().x, view.overscroll().y) +
            Math.abs(Math.log(view.overzoom())) * 400
        );
      });

      drive(fixture, time);
      await wait(150);
      time.frames(120);
      off();

      expect({
        peak,
        shrunk: fixture.cropper.getValue().size.width < 1,
      }).toStrictEqual({ peak: 0, shrunk: true });
    }
  );

  it("ctrl takes the wheel after a page scroll, a zero delta decides nothing, and a held gesture keeps it", async () => {
    const pinch = mount();
    const zero = mount();
    const panned = mount();
    const held = mount();

    zero.cropper.setZoom(2, { emit: false });
    panned.cropper.setZoom(2, { emit: false });
    held.cropper.setZoom(2, { emit: false });
    await frames();
    const scrolled = wheel(pinch, { deltaY: 40 });
    const pinched = wheel(pinch, { ctrlKey: true, deltaY: -20 });

    wheel(zero, { deltaY: 0 });
    const afterZero = wheel(zero, { deltaY: 40 });

    pointer(panned, "pointerdown", 1, 200, 150);
    const pannedValue = panned.cropper.getValue();
    const duringPan = wheel(panned, { deltaY: 40 });
    const panState = {
      interacting: panned.cropper.getState().interacting,
      kept: panned.cropper.getValue() === pannedValue,
    };

    pointer(panned, "pointerup", 1, 200, 150);
    held.cropper.begin("resize", undefined, "handle");
    const heldValue = held.cropper.getValue();
    const duringResize = wheel(held, { deltaY: 40 });

    await wait(200);

    expect({
      afterZero,
      duringPan,
      duringResize,
      heldInteracting: held.cropper.getState().interacting,
      heldKept: held.cropper.getValue() === heldValue,
      panState,
      pannedAfter: panned.cropper.getState().interacting,
      pinchZoomed: pinch.cropper.getZoom() > 1.1,
      pinched,
      scrolled,
    }).toStrictEqual({
      afterZero: false,
      duringPan: true,
      duringResize: true,
      heldInteracting: "resize",
      heldKept: true,
      panState: { interacting: "pan", kept: true },
      pannedAfter: null,
      pinchZoomed: true,
      pinched: false,
      scrolled: true,
    });

    held.cropper.end(undefined, "handle");
  });

  it.each([
    ["below the smallest zoom", "min", 1],
    ["above the largest zoom", "max", -1],
  ] as const)(
    "ctrl stretches %s only at the limit, picks up the stretch where the spring left it and springs back",
    async (_edge, end, sign) => {
      const time = fakeClock();
      const fixture = mount(400, 300, false, time.clock);

      await frames();
      time.frames(2);
      const limit = end === "min" ? 1 : fixture.cropper.getMaxZoom();

      fixture.cropper.setZoom(end === "min" ? 3 : limit / 3, { emit: false });
      time.frame();
      const view = viewOf(fixture.cropper);
      const early: number[] = [];

      for (let i = 0; i < 20; i += 1) {
        wheel(fixture, { ctrlKey: true, deltaY: sign * 8 });

        if (
          view.overzoom() !== 1 &&
          Math.abs(fixture.cropper.getZoom() - limit) > 1e-6
        ) {
          early.push(fixture.cropper.getZoom());
        }
      }

      for (let i = 0; i < 6; i += 1) {
        wheel(fixture, { ctrlKey: true, deltaY: sign * 50 });
      }

      const stretched = {
        early,
        outward: (view.overzoom() - 1) * sign < 0,
        zoom: near(fixture.cropper.getZoom(), limit, 6),
      };

      await wait(200);
      time.frames(3);
      const midway = view.overzoom();

      wheel(fixture, { ctrlKey: true, deltaY: sign });

      expect({
        jump: Math.abs(view.overzoom() - midway) < 0.02,
        midway: midway !== 1,
        stretched,
        zoom: near(fixture.cropper.getZoom(), limit, 6),
      }).toStrictEqual({
        jump: true,
        midway: true,
        stretched: { early: [], outward: true, zoom: true },
        zoom: true,
      });

      await wait(200);
      time.frames(120);
      await expect.poll(() => view.overzoom()).toBe(1);
    }
  );

  it("pans by default, sideways with shift, and the wheel option picks zoom or the page", async () => {
    const plain = mount();

    plain.cropper.setZoom(2, { emit: false });
    await frames();
    const before = plain.cropper.getValue().center;
    const shifted = wheel(plain, { deltaY: 30, shiftKey: true });
    const after = plain.cropper.getValue().center;
    const lines = await pannedBy({ deltaMode: 1, deltaY: 3 });
    const linePixels = await pannedBy({ deltaY: 48 });
    const pages = await pannedBy({ deltaMode: 2, deltaY: 1 });
    const pagePixels = await pannedBy({ deltaY: 300 });

    expect({
      lines,
      pages,
      shifted,
      sideways: after.x > before.x,
      y: after.y,
    }).toStrictEqual({
      lines: linePixels,
      pages: pagePixels,
      shifted: false,
      sideways: true,
      y: before.y,
    });

    const zooms = mount(400, 300, false, undefined, { wheel: "zoom" });
    const changes: string[] = [];
    const commits: string[] = [];

    zooms.cropper.on("change", (_, details) => {
      changes.push(details.reason);
    });

    zooms.cropper.on("commit", (_, details) => {
      commits.push(details.reason);
    });

    await frames();
    const zoomPassed = wheel(zooms, { deltaY: -50 });

    await frames();

    expect({
      changes,
      zoomPassed,
      zoomed: zooms.cropper.getZoom() > 1,
    }).toStrictEqual({ changes: ["wheel"], zoomPassed: false, zoomed: true });

    await expect
      .poll(() => commits, { timeout: 5000 })
      .toStrictEqual(["wheel"]);

    const none = mount(400, 300, false, undefined, { wheel: "none" });

    none.cropper.setZoom(2, { emit: false });
    await frames();
    const value = none.cropper.getValue();
    const plainPassed = wheel(none, { deltaY: 40 });
    const untouched = {
      interacting: none.cropper.getState().interacting,
      kept: none.cropper.getValue() === value,
    };
    const ctrlPassed = wheel(none, { ctrlKey: true, deltaY: -20 });

    expect({
      ctrlPassed,
      plainPassed,
      untouched,
      zoomed: none.cropper.getZoom() > 2,
    }).toStrictEqual({
      ctrlPassed: false,
      plainPassed: true,
      untouched: { interacting: null, kept: true },
      zoomed: true,
    });
  });

  it("one ctrl wheel notch zooms the same at any browser zoom", () => {
    const ratios = [1, 0.9, 0.800000011920929, 1.1, 1.5].map((dpr) => {
      vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(dpr);
      const r = rig();

      wheelOn(r.viewport, { ctrlKey: true, deltaY: -100 / dpr });

      return r.cropper.getZoom();
    });

    expect(ratios.map((ratio) => near(ratio, ratios[0] ?? 0, 6))).toStrictEqual(
      ratios.map(() => true)
    );
  });

  it("zoom at a limit leaves the centre where it was", () => {
    const capped = rig();

    capped.cropper.setOptions({ maxZoom: 4 });
    capped.cropper.setZoom(4);
    capped.time.frames(1);
    const { x, y } = capped.cropper.getValue().center;

    for (let i = 0; i < 4; i += 1) {
      wheelOn(capped.viewport, {
        clientX: 390,
        clientY: 290,
        ctrlKey: true,
        deltaY: -50,
      });

      capped.time.frames(1);
    }

    const square = rig();

    square.cropper.setAspect(1, { emit: false });
    square.time.frames(1);

    wheelOn(square.viewport, {
      clientX: 390,
      clientY: 150,
      ctrlKey: true,
      deltaY: 50,
    });

    expect({
      capped: [
        near(capped.cropper.getValue().center.x, x, 9),
        near(capped.cropper.getValue().center.y, y, 9),
      ],
      square: near(square.cropper.getValue().center.x, 0.5, 9),
    }).toStrictEqual({
      capped: [true, true],
      square: true,
    });
  });

  it("the page keeps its scroll and page zoom only where the cropper does not take the gesture", () => {
    const disabled = rig({ wheel: "zoom" });

    disabled.cropper.setOptions({ disabled: true });
    const disabledPlain = wheelOn(disabled.viewport, { deltaY: 40 });
    const disabledCtrl = wheelOn(disabled.viewport, {
      ctrlKey: true,
      deltaY: 40,
    });
    const sideways = rig({ wheel: "zoom" });
    const sidewaysPlain = wheelOn(sideways.viewport, { deltaX: 40 });
    const sidewaysState = sideways.cropper.getState().interacting;
    const sidewaysCtrl = wheelOn(sideways.viewport, {
      ctrlKey: true,
      deltaX: 40,
    });
    const dragging = rig();

    fire(dragging.viewport, "pointerdown", 50);
    const draggingCtrl = wheelOn(dragging.viewport, {
      ctrlKey: true,
      deltaY: 40,
    });

    fire(dragging.viewport, "pointerup", 50);
    const inert = rig();

    inert.cropper.setOptions({ disabled: true });
    const inertGestures = ["gesturestart", "gesturechange", "gestureend"].map(
      (type) => safari(inert.viewport, type)
    );

    inert.cropper.setOptions({ disabled: false });
    inert.cropper.setImage(null);
    const emptyGesture = safari(inert.viewport, "gesturestart");

    inert.cropper.setImage(PHOTO);
    fire(inert.viewport, "pointerdown", 50);
    const pressedGesture = safari(inert.viewport, "gesturestart");

    fire(inert.viewport, "pointerup", 50);
    const taken = rig();

    safari(taken.viewport, "gesturestart");
    safari(taken.viewport, "gesturechange", { scale: 2 });
    fire(taken.viewport, "pointerdown", 100, 100);
    const held = taken.cropper.getValue();

    safari(taken.viewport, "gesturechange", { scale: 1.2 });
    const kept = taken.cropper.getValue() === held;

    fire(taken.viewport, "pointerup", 100, 100);

    expect({
      disabledCtrl: disabledCtrl.defaultPrevented,
      disabledPlain: disabledPlain.defaultPrevented,
      draggingCtrl: draggingCtrl.defaultPrevented,
      emptyGesture,
      inertGestures,
      kept,
      pressedGesture,
      sidewaysCtrl: sidewaysCtrl.defaultPrevented,
      sidewaysPlain: sidewaysPlain.defaultPrevented,
      sidewaysState,
    }).toStrictEqual({
      disabledCtrl: true,
      disabledPlain: false,
      draggingCtrl: true,
      emptyGesture: true,
      inertGestures: [true, true, true],
      kept: true,
      pressedGesture: false,
      sidewaysCtrl: true,
      sidewaysPlain: false,
      sidewaysState: null,
    });
  });
});

const pinchPath = (radius: (t: number) => number, degrees: number) => {
  const a: [number, number][] = [];
  const b: [number, number][] = [];

  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const angle = ((degrees * Math.PI) / 180) * t;
    const r = radius(t);

    a.push([300 - r * Math.cos(angle), 300 - r * Math.sin(angle)]);
    b.push([300 + r * Math.cos(angle), 300 + r * Math.sin(angle)]);
  }

  return [a, b] as const;
};

describe("pinch", () => {
  afterEach(clean);

  it("keeps the angle and still zooms with rotateGesture off", async () => {
    const fixture = mount(400, 300, false, undefined, {
      rotateGesture: false,
    });

    await frames();
    const turn = (20 * Math.PI) / 180;
    const dx = 150 * Math.cos(turn);
    const dy = 150 * Math.sin(turn);

    pointer(fixture, "pointerdown", 1, 100, 150);
    pointer(fixture, "pointerdown", 2, 300, 150);
    pointer(fixture, "pointermove", 1, 200 - dx, 150 - dy);
    pointer(fixture, "pointermove", 2, 200 + dx, 150 + dy);
    pointer(fixture, "pointerup", 1, 200 - dx, 150 - dy);
    pointer(fixture, "pointerup", 2, 200 + dx, 150 + dy);

    expect([
      fixture.cropper.getValue().rotation,
      fixture.cropper.getZoom() > 1.3,
    ]).toStrictEqual([0, true]);
  });

  it.runIf(server.browser === "chromium")(
    "a real touch pinch turns without shrinking and keeps the photo point under the fingers",
    async () => {
      const turning = mount(600, 600);

      await frames();
      const turned = viewOf(turning.cropper);
      let smallest = 1;
      const off = turned.onFrame(() => {
        smallest = Math.min(smallest, turned.overzoom());
      });
      const [turnA, turnB] = pinchPath(() => 100, 20);

      await commands.pinch(`#${turning.id}`, turnA, turnB, true);
      await until(() => turning.cropper.getValue().rotation > 10);
      await frames(2);
      off();
      turning.viewport.style.display = "none";
      const fixture = mount(600, 600);

      await frames();
      const view = viewOf(fixture.cropper);
      const start = view.frame();

      if (!start) {
        throw new Error("no frame");
      }

      const mid = { x: 300, y: 300 };
      const anchor = applyHomography(invertMatrix3(start.matrix), mid);
      const [a, b] = pinchPath((t) => 60 * (1 + t), 20);

      await commands.pinch(`#${fixture.id}`, a, b, true);
      await until(() => Math.round(fixture.cropper.getValue().rotation) === 15);
      await frames(2);
      const end = view.frame();

      if (!end) {
        throw new Error("no frame");
      }

      const shown = applyHomography(end.matrix, anchor);

      expect({
        drift: Math.hypot(shown.x - mid.x, shown.y - mid.y) < 0.1,
        smallest,
      }).toStrictEqual({ drift: true, smallest: 1 });
    }
  );

  it("the finger left after a pinch reports a pan", () => {
    const r = rig();

    r.cropper.setZoom(2, { emit: false });
    fire(r.viewport, "pointerdown", 100, 100, touch(1));
    fire(r.viewport, "pointerdown", 200, 100, touch(2));
    const pinching = r.cropper.getState().interacting;

    fire(r.viewport, "pointerup", 200, 100, touch(2));
    fire(r.viewport, "pointermove", 110, 100, touch(1));
    const left = r.cropper.getState().interacting;

    fire(r.viewport, "pointerup", 110, 100, touch(1));
    expect([pinching, left]).toStrictEqual(["pinch", "pan"]);
  });

  it("a two-finger or safari twist turns without a jump and stops at 45 degrees", () => {
    const twisted = rig();

    safari(twisted.viewport, "gesturestart");
    let last = 0;
    let worst = 0;

    for (const rotation of [2, 6, 8, 6, 3, 1, 0.5, -0.5, -1, -3, -6, -8]) {
      safari(twisted.viewport, "gesturechange", { rotation });
      const now = twisted.cropper.getValue().rotation;

      worst = Math.max(worst, Math.abs(now - last));
      last = now;
    }

    safari(twisted.viewport, "gestureend");
    const r = rig();

    const finger = (id: number, type: string, angle: number) => {
      const radians = (angle * Math.PI) / 180;
      const side = id === 1 ? -1 : 1;

      fire(
        r.viewport,
        type,
        200 + side * 80 * Math.cos(radians),
        150 + side * 80 * Math.sin(radians),
        touch(id)
      );
    };

    finger(1, "pointerdown", 0);
    finger(2, "pointerdown", 0);

    for (let angle = 10; angle <= 200; angle += 10) {
      finger(1, "pointermove", angle);
      finger(2, "pointermove", angle);
    }

    const turned = r.cropper.getValue().rotation;

    finger(1, "pointerup", 200);
    finger(2, "pointerup", 200);

    expect({ smooth: worst <= 3, turned }).toStrictEqual({
      smooth: true,
      turned: 45,
    });
  });

  it("a finger lifting mid gesture keeps the band, fires no false settle and springs back once", () => {
    const r = rig();
    const view = viewOf(r.cropper);
    const log: string[] = [];

    fire(r.viewport, "pointerdown", 50, 150, touch(1));
    fire(r.viewport, "pointermove", 350, 150, touch(1));
    const dragged = view.overscroll().x > 50;

    r.time.frames(1);

    r.cropper.on("settle", () => {
      log.push("settle");
    });

    r.cropper.subscribe(() => {
      if (r.cropper.getState().settling) {
        log.push("settling");
      }
    });

    fire(r.viewport, "pointerdown", 200, 150, touch(2));
    r.time.frames(1);
    const shift = view.overscroll().x;

    fire(r.viewport, "pointerup", 200, 150, touch(2));
    r.time.frames(2);
    const lifted = view.overscroll().x;
    const quiet = [...log];

    fire(r.viewport, "pointermove", 351, 150, touch(1));
    const moved = view.overscroll().x;

    fire(r.viewport, "pointerup", 351, 150, touch(1));

    expect({
      dragged,
      lifted: near(lifted, shift, 3),
      moved: Math.abs(moved - shift) < 2,
      quiet,
    }).toStrictEqual({
      dragged: true,
      lifted: true,
      moved: true,
      quiet: [],
    });

    const stretched = rig();
    const band = viewOf(stretched.cropper);
    let settles = 0;

    stretched.cropper.on("settle", () => {
      settles += 1;
    });

    const at = (type: string, id: number, x: number) => {
      fire(stretched.viewport, type, x, 150, touch(id));
    };

    at("pointerdown", 1, 100);
    at("pointerdown", 2, 300);
    at("pointermove", 1, 150);
    at("pointermove", 2, 250);
    stretched.time.frames(1);
    const squeezed = band.overzoom() < 1;

    at("pointerup", 2, 250);
    stretched.time.frames(300);

    expect({ rest: band.overzoom(), settles, squeezed }).toStrictEqual({
      rest: 1,
      settles: 1,
      squeezed: true,
    });

    at("pointerup", 1, 150);
  });
});

const TAKEOVERS: [string, (fixture: Fixture) => void][] = [
  ...(
    [
      ["dial", "dial"],
      ["handle", "resize"],
      ["zoom", "zoom-control"],
    ] as const
  ).map(([part, reason]): [string, (fixture: Fixture) => void] => [
    reason,
    (fixture) => {
      pressers[part]?.(
        fixture.cropper,
        fixture.viewport
      )(
        new PointerEvent("pointerdown", {
          button: 0,
          buttons: 1,
          clientX: 100,
          clientY: 100,
          pointerId: 4,
        })
      );
    },
  ]),
  [
    "pan",
    (fixture) => {
      pointer(fixture, "pointerdown", 1, 200, 150, "mouse");
    },
  ],
  [
    "pinch",
    (fixture) => {
      safari(fixture.viewport, "gesturestart");
    },
  ],
];

describe("inputs that give way", () => {
  afterEach(clean);

  it("a press from any part takes over a dial glide or a wheel turn and keeps it past the idle timer", async () => {
    const time = fakeClock();
    const glide = mount(400, 300, false, time.clock);

    glide.cropper.setZoom(2);
    time.frames(2);
    throwDial(glide.cropper, time);
    const gliding = glide.cropper.getState().interacting;
    const held = glide.cropper.getValue().rotation;
    const { x } = glide.cropper.getValue().center;

    pointer(glide, "pointerdown", 1, 200, 150);
    const pressed = glide.cropper.getState().interacting;

    time.frames(5);
    const { rotation } = glide.cropper.getValue();

    pointer(glide, "pointermove", 1, 240, 150);
    const moved = glide.cropper.getValue().center.x !== x;

    pointer(glide, "pointerup", 1, 240, 150);
    const clock = fakeClock();
    const resize = mount(400, 300, false, clock.clock);

    clock.frames(2);
    throwDial(resize.cropper, clock);
    const box = resize.handle.getBoundingClientRect();

    fire(resize.handle, "pointerdown", box.x, box.y, { pointerId: 3 });
    const resizing = resize.cropper.getState().interacting;

    fire(resize.handle, "pointerup", box.x, box.y, { pointerId: 3 });

    expect({
      after: glide.cropper.getState().interacting,
      gliding,
      moved,
      pressed,
      resizing,
      rotation,
    }).toStrictEqual({
      after: null,
      gliding: "dial",
      moved: true,
      pressed: "pan",
      resizing: "resize",
      rotation: held,
    });

    const takers: Fixture[] = [];
    const right: (string | null)[][] = [];

    for (const [, press] of TAKEOVERS) {
      const fixture = mount();

      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const passed = wheel(fixture, { deltaY: 40 });
      const wheeling = fixture.cropper.getState().interacting;

      press(fixture);

      right.push([
        String(passed),
        wheeling,
        fixture.cropper.getState().interacting,
      ]);

      takers.push(fixture);
    }

    await wait(200);
    const later = takers.map(
      (fixture) => fixture.cropper.getState().interacting
    );

    for (const fixture of takers) {
      fixture.cropper.stop();
    }

    expect({ later, right }).toStrictEqual({
      later: TAKEOVERS.map(([reason]) => reason),
      right: TAKEOVERS.map(([reason]) => ["false", "wheel", reason]),
    });
  });
});

const panning = async (): Promise<Fixture> => {
  const fixture = mount();

  fixture.cropper.setZoom(2, { emit: false });
  await frames();
  pointer(fixture, "pointerdown", 1, 200, 150);
  pointer(fixture, "pointermove", 1, 210, 150);

  return fixture;
};

describe("writes during a held gesture", () => {
  afterEach(clean);

  it("a button pressed mid gesture sticks on the next move and in the commit", async () => {
    const flipped = await panning();
    const commits: boolean[] = [];

    flipped.cropper.on("commit", (value) => {
      commits.push(value.mirrored);
    });

    flipped.cropper.flip("x", { reason: "flip" });
    pointer(flipped, "pointermove", 1, 220, 150);
    const panMirrored = flipped.cropper.getValue().mirrored;

    pointer(flipped, "pointerup", 1, 220, 150);
    await frames();
    const pinched = mount();

    pinched.cropper.setZoom(2, { emit: false });
    await frames();
    pointer(pinched, "pointerdown", 1, 150, 150);
    pointer(pinched, "pointerdown", 2, 250, 150);
    pointer(pinched, "pointermove", 2, 260, 150);
    pinched.cropper.flip("x", { reason: "flip" });
    pointer(pinched, "pointermove", 2, 270, 150);
    const pinchMirrored = pinched.cropper.getValue().mirrored;

    pointer(pinched, "pointerup", 1, 150, 150);
    pointer(pinched, "pointerup", 2, 270, 150);
    const turned = await panning();

    turned.cropper.setAspect(16 / 9);
    pointer(turned, "pointermove", 1, 215, 150);
    turned.cropper.rotate90("cw", { reason: "rotate-90" });
    pointer(turned, "pointermove", 1, 220, 150);
    const value = turned.cropper.getValue();
    const stateAspect = turned.cropper.getCropState()?.aspect;

    pointer(turned, "pointerup", 1, 220, 150);
    const resized = mount();

    await frames();
    const box = resized.handle.getBoundingClientRect();

    const send = (type: string, d: number): void => {
      fire(resized.handle, type, box.x + d, box.y + d, { pointerId: 5 });
    };

    send("pointerdown", 0);
    send("pointermove", -30);
    resized.cropper.flip("x", { reason: "flip" });
    const { width } = resized.cropper.getValue().size;

    send("pointermove", -31);
    const resize = resized.cropper.getValue();

    send("pointerup", -31);

    expect({
      aspect: [value.aspect, stateAspect],
      commits,
      panMirrored,
      pinchMirrored,
      quarterTurns: value.quarterTurns,
      resizeMirrored: resize.mirrored,
      resizeWidth: Math.abs(resize.size.width - width) < 0.01,
    }).toStrictEqual({
      aspect: [expect.closeTo(9 / 16, 9), expect.closeTo(9 / 16, 9)],
      commits: [true],
      panMirrored: true,
      pinchMirrored: true,
      quarterTurns: 1,
      resizeMirrored: true,
      resizeWidth: true,
    });
  });

  it("an outside write or a cancelled change mid gesture survives the next move", () => {
    const cancelled = rig();

    cancelled.cropper.setZoom(2, { emit: false });
    cancelled.time.frames(1);

    cancelled.cropper.on("change", (next, details) => {
      if (next.center.x < 0.45) {
        details.cancel();
      }
    });

    fire(cancelled.viewport, "pointerdown", 100, 100);
    fire(cancelled.viewport, "pointermove", 180, 100);
    cancelled.time.frames(1);
    fire(cancelled.viewport, "pointermove", 100, 100);
    cancelled.time.frames(1);
    const back = cancelled.cropper.getValue().center.x;

    fire(cancelled.viewport, "pointerup", 100, 100);
    const resized = rig();

    fire(resized.handle, "pointerdown", 10);
    fire(resized.handle, "pointermove", 0);
    resized.cropper.setZoom(2);
    const written = resized.cropper.getValue().size;

    fire(resized.handle, "pointermove", 1);
    const moved = resized.cropper.getValue().size;

    fire(resized.handle, "pointerup", 1);
    const pinched = rig();

    safari(pinched.viewport, "gesturestart");
    safari(pinched.viewport, "gesturechange", { scale: 1.1 });
    pinched.cropper.setZoom(3);
    safari(pinched.viewport, "gesturechange", { scale: 1.1 });
    const zoom = pinched.cropper.getZoom();

    safari(pinched.viewport, "gestureend", { scale: 1.1 });

    expect({
      back: near(back, 0.5, 6),
      moved: [
        near(moved.height, written.height, 1),
        near(moved.width, written.width, 1),
      ],
      zoom: near(zoom, 3, 3),
    }).toStrictEqual({ back: true, moved: [true, true], zoom: true });
  });

  it("escape after an outside write mid gesture keeps the write", () => {
    for (const part of [(r: Rig) => r.viewport, (r: Rig) => r.handle]) {
      const r = rig();

      fire(part(r), "pointerdown", 100);
      fire(part(r), "pointermove", 110);
      r.cropper.flip("x");
      pressEscape();

      expect([
        r.cropper.getValue().mirrored,
        r.cropper.getState().interacting,
      ]).toStrictEqual([true, null]);
    }

    const r = rig();

    fire(r.handle, "pointerdown", 10);
    fire(r.handle, "pointermove", 0);
    r.cropper.setZoom(2);
    pressEscape();
    r.time.frames(1);

    expect({
      height: viewOf(r.cropper).frame()?.rect.height,
      x: near(centre(r).x, 200, 0),
      zoom: near(r.cropper.getZoom(), 2, 3),
    }).toStrictEqual({
      height: 300,
      x: true,
      zoom: true,
    });
  });

  it("a new photo under a held pan, handle or dial stays the new photo", () => {
    for (const [, pick] of parts) {
      const r = rig();
      const part = pick(r);

      drag(r, part);
      r.cropper.setImage({ height: 900, width: 300 });
      fire(part, "pointermove", 170, 45);
      r.time.frames(1);
      const moved = r.cropper.getValue();

      fire(part, "pointermove", 150, 25);
      const follows = r.cropper.getValue() !== moved;

      fire(part, "pointerup", 150, 25);
      r.time.frames(2);

      expect({
        follows,
        imageWidth: r.cropper.getCropState()?.image.width,
        pixels: (r.cropper.getPixelCrop()?.pixelRect?.width ?? 0) <= 300,
        sized: r.cropper.getValue().size.width > 0.2,
      }).toStrictEqual({
        follows: true,
        imageWidth: 300,
        pixels: true,
        sized: true,
      });
    }

    const escaped = rig();

    drag(escaped, escaped.viewport);
    escaped.cropper.setImage({ height: 900, width: 300 });
    pressEscape();
    const swappedWidth = escaped.cropper.getCropState()?.image.width;

    drag(escaped, escaped.viewport);
    escaped.cropper.setImage(null);
    pressEscape();
    const held = rig();

    drag(held, held.handle);
    held.cropper.setImage({ height: 900, width: 300 });
    held.time.frames(1);
    const heldHeight = viewOf(held.cropper).frame()?.rect.height ?? 0;

    fire(held.handle, "pointerup", 160, 40);
    const released = rig();

    fire(released.handle, "pointerdown", 10);
    fire(released.handle, "pointermove", 0);
    fire(released.handle, "pointerup", 0);
    released.cropper.setImage({ height: 3000, width: 1000 });
    released.time.frames(1);
    const releasedHeight = viewOf(released.cropper).frame()?.rect.height ?? 0;
    const removed = rig();
    const sheets = document.adoptedStyleSheets.length;

    fire(removed.handle, "pointerdown", 10);
    fire(removed.handle, "pointermove", 0);
    removed.cropper.setImage(null);
    fire(removed.handle, "pointermove", 5);
    const ended = {
      interacting: removed.cropper.getState().interacting,
      sheets: document.adoptedStyleSheets.length - sheets,
    };

    fire(removed.handle, "pointerup", 5);
    removed.cropper.setImage(PHOTO);
    removed.time.frames(1);
    fire(removed.viewport, "pointerdown", 100);
    const next = removed.cropper.getState().interacting;

    fire(removed.viewport, "pointerup", 100);

    expect({
      ended,
      escapedReady: escaped.cropper.getState().ready,
      heldFits: heldHeight <= 300,
      next,
      releasedFits: releasedHeight <= 300,
      swappedWidth,
    }).toStrictEqual({
      ended: { interacting: null, sheets: 0 },
      escapedReady: false,
      heldFits: true,
      next: "pan",
      releasedFits: true,
      swappedWidth: 300,
    });
  });

  it("a new photo under a safari pinch or a recentre takes over cleanly", async () => {
    const emptied = rig();

    safari(emptied.viewport, "gesturestart");
    emptied.cropper.setImage(null);
    safari(emptied.viewport, "gesturechange", { scale: 1.2 });
    safari(emptied.viewport, "gestureend", { scale: 1.2 });
    const swapped = rig();

    safari(swapped.viewport, "gesturestart");
    swapped.cropper.setImage(null);
    safari(swapped.viewport, "gesturechange", { scale: 1.2 });
    swapped.cropper.setImage({ height: 900, width: 300 });
    swapped.time.frames(1);
    safari(swapped.viewport, "gesturechange", { scale: 1.2 });
    safari(swapped.viewport, "gesturechange", { scale: 2.4 });
    const zoom = swapped.cropper.getZoom();

    safari(swapped.viewport, "gestureend", { scale: 2.4 });

    expect({
      emptied: emptied.cropper.getState().interacting,
      swapped: swapped.cropper.getState().interacting,
      zoom: near(zoom, 2, 1),
    }).toStrictEqual({
      emptied: null,
      swapped: null,
      zoom: true,
    });

    const r = rig();
    const view = viewOf(r.cropper);

    view.setOptions({ recenterDelay: 0 });
    fire(r.handle, "pointerdown", 10);
    fire(r.handle, "pointermove", -120, -80);
    fire(r.handle, "pointerup", -120, -80);
    r.time.frames(2);
    await until(() => view.chrome().transition === "recenter");
    r.time.frames(2);
    r.cropper.setImage({ height: 3000, width: 1000 });
    r.time.frames(2);
    const rect = view.frame()?.rect;

    expect({
      fits: (rect?.height ?? 0) <= 300 && (rect?.y ?? -1) >= 0,
      transition: view.chrome().transition,
    }).toStrictEqual({ fits: true, transition: null });
  });

  it("a hidden tab leaves running motion alone and a dial throw settles once", () => {
    const idle = rig();
    const events: string[] = [];

    for (const type of ["stop", "frame"] as const) {
      idle.cropper.on(type, () => {
        events.push(type);
      });
    }

    hideTab();
    const quiet = [...events];
    let calls = 0;

    idle.cropper.run(() => {
      calls += 1;

      return calls < 5;
    }, false);

    idle.time.frames(2);
    hideTab();
    idle.time.frames(3);
    const thrown = rig();
    const settle = vi.fn<() => void>();

    thrown.cropper.on("settle", settle);
    throwDial(thrown.cropper, thrown.time);
    const before = thrown.cropper.getState().interacting;
    const at = thrown.cropper.getValue().rotation;

    hideTab();
    const hidden = thrown.cropper.getState().interacting;

    thrown.time.frames(240);

    expect({
      after: thrown.cropper.getState().interacting,
      before,
      calls,
      hidden,
      quiet,
      settles: settle.mock.calls.length,
      turned: thrown.cropper.getValue().rotation > at,
    }).toStrictEqual({
      after: null,
      before: "dial",
      calls: 5,
      hidden: "dial",
      quiet: [],
      settles: 1,
      turned: true,
    });
  });
});

const LOSSES: [string, (r: Rig, part: HTMLElement) => void, boolean][] = [
  [
    "its binders are released",
    (r) => {
      r.unbind();
    },
    false,
  ],
  ["the window blurs", blurWindow, false],
  ["the tab hides", hideTab, false],
  [
    "stop is called",
    (r) => {
      r.cropper.stop();
    },
    false,
  ],
  [
    "a mouse moves with no button held",
    (_, part) => {
      fire(part, "pointermove", 220, 80, { buttons: 0 });
    },
    true,
  ],
  [
    "the part is hidden",
    (_, part) => {
      part.style.display = "none";
      fire(part, "pointermove", 20, 200);
    },
    true,
  ],
  [
    "the release lands on another element",
    () => {
      fire(document.body, "pointerup", 160, 40);
    },
    false,
  ],
];

const exitFixture = () => {
  const time = fakeClock();
  const sheets = document.adoptedStyleSheets.length;
  const fixture = mount(400, 300, false, time.clock);
  const { cropper, viewport } = fixture;

  viewport.style.cursor = "grab";
  time.frame();
  cropper.setZoom(2, { emit: false });
  time.frames(2);
  const ends: string[] = [];

  cropper.on("gestureend", (reason) => {
    ends.push(reason);
  });

  const cropX = (): number | undefined => cropper.getCropState()?.crop.x;

  const gestures = {
    pan: (x = 170): void => {
      pointer(fixture, "pointerdown", 1, 200, 150, "mouse");
      pointer(fixture, "pointermove", 1, x, 150, "mouse");
      time.frame();
    },
    pinch: (): void => {
      pointer(fixture, "pointerdown", 1, 150, 150);
      pointer(fixture, "pointerdown", 2, 250, 150);
      pointer(fixture, "pointermove", 2, 300, 150);
      time.frame();
    },
    resize: (): void => {
      const box = fixture.handle.getBoundingClientRect();

      fire(fixture.handle, "pointerdown", box.x, box.y, { pointerId: 5 });

      fire(fixture.handle, "pointermove", box.x - 80, box.y - 60, {
        pointerId: 5,
      });

      time.frame();
    },
  };

  const afterwards = () => {
    const { interacting } = cropper.getState();
    const held = document.adoptedStyleSheets.length - sheets;
    const blocked = !cropper.begin("resize", undefined, "other");

    cropper.end(undefined, "other");
    const parked = cropX();

    pointer(fixture, "pointermove", 1, 20, 150);
    pointer(fixture, "pointermove", 2, 20, 150);
    const ghostMoved = cropX() !== parked;

    pointer(fixture, "pointerdown", 3, 200, 150);
    const next = cropper.getState().interacting;

    pointer(fixture, "pointermove", 3, 240, 150);
    const movedAgain = cropX() !== parked;

    pointer(fixture, "pointerup", 3, 240, 150);

    return { blocked, ghostMoved, held, interacting, movedAgain, next };
  };

  return { afterwards, cropX, cropper, ends, fixture, gestures, sheets };
};

const FREE = {
  blocked: false,
  ghostMoved: false,
  held: 0,
  interacting: null,
  movedAgain: true,
  next: "pan",
};

const VIEWPORT_LOSSES: [string, (fixture: Fixture) => unknown][] = [
  [
    "a window blur",
    () => {
      globalThis.dispatchEvent(new Event("blur"));
    },
  ],
  [
    "a hidden tab, and not a visible one,",
    (fixture) => {
      const state = vi.spyOn(document, "visibilityState", "get");

      state.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      const visible = fixture.cropper.getState().interacting;

      state.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      state.mockRestore();

      return visible;
    },
  ],
  [
    "a pointercancel",
    (fixture) => {
      pointer(fixture, "pointercancel", 1, 200, 150);
      pointer(fixture, "pointercancel", 2, 200, 150);
    },
  ],
];

describe("losing a gesture", () => {
  afterEach(clean);

  it("every part lets go when its gesture is lost", () => {
    for (const [, lose, keeps] of LOSSES) {
      for (const [, pick] of parts) {
        const r = rig();
        const part = pick(r);
        const sheets = document.adoptedStyleSheets.length;

        drag(r, part);
        const before = r.cropper.getValue();

        lose(r, part);
        const held = r.cropper.getValue();
        const { interacting } = r.cropper.getState();

        fire(part, "pointermove", 220, 80);
        fire(part, "pointerup", 220, 80);
        r.time.frames(5);

        expect({
          dragging: dialState(r.cropper).dragging(),
          escapePrevented: pressEscape().defaultPrevented,
          extraSheets: document.adoptedStyleSheets.length > sheets,
          held: r.cropper.getValue() === held,
          interacting,
          kept: keeps ? held === before : true,
          next: r.cropper.begin("pan", undefined, {}),
        }).toStrictEqual({
          dragging: false,
          escapePrevented: false,
          extraSheets: false,
          held: true,
          interacting: null,
          kept: true,
          next: true,
        });
      }
    }

    const disabled = rig();

    fire(disabled.viewport, "pointerdown", 50, 150);
    disabled.cropper.setOptions({ disabled: true });
    fire(disabled.viewport, "pointermove", 250, 150);
    expect(viewOf(disabled.cropper).overscroll().x).toBe(0);
    fire(disabled.viewport, "pointerup", 250, 150);

    for (const released of [false, true]) {
      const r = rig();

      fire(r.handle, "pointerdown", 10);
      fire(r.handle, "pointermove", -120, -80);
      r.time.frames(1);

      if (released) {
        fire(r.handle, "pointerup", -120, -80);
      }

      const off = Math.abs(centre(r).x - 200) > 5;

      r.cropper.stop();

      expect({
        centre: [near(centre(r).x, 200, 0), near(centre(r).y, 150, 0)],
        off,
      }).toStrictEqual({ centre: [true, true], off: true });
    }
  });

  it.each(
    VIEWPORT_LOSSES.flatMap(([name, lose]) =>
      (["pan", "pinch"] as const).map(
        (gesture) => [name, gesture, lose] as const
      )
    )
  )(
    "%s ends a %s where it got to and frees the cropper",
    (_, gesture, lose) => {
      const { afterwards, cropX, cropper, ends, fixture, gestures } =
        exitFixture();

      gestures[gesture]();
      const started = cropper.getState().interacting;
      const reached = cropX();
      const visible = lose(fixture);
      const lost = { ends: [...ends], stayed: cropX() === reached };

      expect({
        afterwards: afterwards(),
        ...lost,
        started,
        visible: visible ?? gesture,
      }).toStrictEqual({
        afterwards: FREE,
        ends: [gesture],
        started: gesture,
        stayed: true,
        visible: gesture,
      });
    }
  );

  it.each(["pan", "pinch", "resize"] as const)(
    "escape cancels a %s and puts the crop back",
    (gesture) => {
      const { afterwards, cropper, ends, gestures } = exitFixture();
      const crop = cropper.getCropState()?.crop;
      const value = cropper.getValue();

      if (gesture === "pan") {
        gestures.pan(-4000);
      } else {
        gestures[gesture]();
      }

      const changed = cropper.getValue() !== value;
      const stretched = viewOf(cropper).overscroll().x !== 0;
      const heard = vi.fn<() => void>();

      document.body.addEventListener("keydown", heard);
      const key = pressEscape();

      document.body.removeEventListener("keydown", heard);

      expect({
        changed,
        crop: cropper.getCropState()?.crop,
        ends,
        heard: heard.mock.calls.length,
        overscroll: viewOf(cropper).overscroll(),
        prevented: key.defaultPrevented,
        stretched,
        value: cropper.getValue(),
      }).toStrictEqual({
        changed: true,
        crop,
        ends: [gesture],
        heard: 0,
        overscroll: { x: 0, y: 0 },
        prevented: true,
        stretched: gesture === "pan",
        value,
      });

      expect({
        afterwards: afterwards(),
        again: pressEscape().defaultPrevented,
      }).toStrictEqual({ afterwards: FREE, again: false });
    }
  );

  it("the viewport going away ends a pan or a wheel turn and frees the cropper", async () => {
    const { cropper, ends, gestures, sheets } = exitFixture();

    gestures.pan();
    clean();

    expect({
      ends,
      interacting: cropper.getState().interacting,
      sheets: document.adoptedStyleSheets.length,
    }).toStrictEqual({ ends: ["pan"], interacting: null, sheets });

    const wheeled = createCropper({ image: PHOTO });
    const element = document.createElement("div");

    element.style.cssText = "position:relative;width:400px;height:300px;";
    document.body.append(element);
    const unbind = bindViewport(wheeled, element);

    cleanups.push(() => {
      viewOf(wheeled).destroy();
      wheeled.destroy();
      element.remove();
    });

    await frames();
    wheeled.setZoom(2, { emit: false });
    await frames();
    wheelOn(element, { deltaY: 40 });
    const during = wheeled.getState().interacting;

    unbind();
    const after = wheeled.getState().interacting;
    const next = wheeled.begin("pan", undefined, "other");

    wheeled.end(undefined, "other");

    expect({ after, during, next }).toStrictEqual({
      after: null,
      during: "wheel",
      next: true,
    });
  });
});

const pair = () => {
  const fixture = mount();
  const element = document.createElement("div");

  element.style.cssText = "position:relative;width:400px;height:300px;";
  document.body.append(element);
  const off = bindViewport(fixture.cropper, element);

  cleanups.push(() => {
    off();
    element.remove();
  });

  return { element, fixture, off, view: viewOf(fixture.cropper) };
};

describe("two viewports on one cropper", () => {
  afterEach(clean);

  it("the visible or the remaining one holds the frame, and cleanup lets go", async () => {
    const { element, fixture, off, view } = pair();
    const inset = () => view.frame()?.layout.inset.left;

    await frames();
    element.style.display = "none";
    await until(() => inset() === 20);
    fixture.viewport.style.display = "none";
    element.style.display = "block";
    await until(() => inset() === 0);
    fixture.viewport.style.display = "block";
    element.style.display = "none";
    await until(() => inset() === 20);
    element.style.display = "block";
    off();
    const older = inset();
    const box = fixture.viewport.getBoundingClientRect();
    const point = view.local({ clientX: box.x + 10, clientY: box.y + 20 });

    wheel(fixture, { ctrlKey: true, deltaY: -30 });
    const second = pair();

    await frames();
    const controller = viewportController(second.fixture.cropper);
    const other = document.createElement("div");

    other.style.cssText = "width:400px;height:300px;padding:5px;";
    document.body.append(other);

    cleanups.push(() => {
      other.remove();
    });

    controller.setElement(other);
    const third = second.view.frame()?.layout.inset.left;

    controller.setElement(null);
    const newer = second.element.getBoundingClientRect();
    const alone = createCropper({ image: PHOTO });
    const target = document.createElement("div");

    target.style.cssText = "position:relative;width:40px;height:40px;";
    document.body.append(target);

    cleanups.push(() => {
      alone.destroy();
      target.remove();
    });

    const unbind = bindViewport(alone, target);

    await frames();
    const bound = viewOf(alone).frame() !== null;

    unbind();

    expect({
      bound,
      newerInset: second.view.frame()?.layout.inset.left,
      newerPoint: second.view.local({
        clientX: newer.x + 1,
        clientY: newer.y + 2,
      }),
      older,
      point,
      third,
      unbound: viewOf(alone).frame(),
      zoomed: fixture.cropper.getZoom() > 1,
    }).toStrictEqual({
      bound: true,
      newerInset: 0,
      newerPoint: { x: 1, y: 2 },
      older: 20,
      point: { x: 10, y: 20 },
      third: 5,
      unbound: null,
      zoomed: true,
    });
  });
});

describe("a removed photo", () => {
  afterEach(clean);

  it("leaves no crop box or mask hole, a hidden viewport keeps them, and the next photo lays out again", async () => {
    const fixture = mount();
    const { area, mask, viewport } = fixture;
    const view = viewOf(fixture.cropper);
    const box = () => [area.style.width, area.style.left, mask.style.clipPath];

    await frames();
    const shown = box();

    fixture.cropper.setImage(null);
    await frames();
    const removed = box();

    fixture.cropper.setImage(PHOTO);
    await frames();
    const back = box();

    viewport.style.display = "none";
    await until(() => view.frame() === null);
    await frames();
    const hidden = box();

    viewport.style.display = "block";
    await frames();
    const revealed = box();

    viewport.style.display = "none";
    await until(() => view.frame() === null);
    fixture.cropper.setImage(null);
    viewport.style.display = "block";
    await frames(3);

    expect({
      back,
      cleared: area.style.width,
      hidden,
      removed,
      revealed,
      shownHole: shown[2] !== "",
    }).toStrictEqual({
      back: shown,
      cleared: "",
      hidden: shown,
      removed: ["", "", ""],
      revealed: shown,
      shownHole: true,
    });
  });
});

const HOSTS = [
  ["transform: scale(2)", "transform:scale(2);transform-origin:0 0;", 200],
  ["zoom: 2", "zoom:2;", 200],
  ["no scale and a fractional width", "", 200.5],
] as const;

describe.each(HOSTS)("under an ancestor with %s", (_, css, width) => {
  afterEach(clean);

  const hosted = async (): Promise<Fixture> => {
    const host = document.createElement("div");

    host.style.cssText = `position:fixed;left:0;top:0;${css}`;
    document.body.append(host);
    const fixture = mount(width, 160);

    host.append(fixture.viewport);

    cleanups.push(() => {
      host.remove();
    });

    await frames();

    return fixture;
  };

  it("a pan moves the photo with the pointer", async () => {
    const fixture = await hosted();

    fixture.cropper.setZoom(3);
    await frames();
    const before = fixture.image.getBoundingClientRect();

    await commands.drag(`#${fixture.id}`, [
      [40, 40],
      [30, 35],
      [20, 30],
    ]);

    await frames();
    const after = fixture.image.getBoundingClientRect();

    expect([after.x - before.x, after.y - before.y]).toStrictEqual([
      expect.closeTo(-20, 0),
      expect.closeTo(-10, 0),
    ]);
  });

  it("a handle keeps its corner under the pointer", async () => {
    const fixture = await hosted();
    const start = fixture.area.getBoundingClientRect();
    const outer = fixture.viewport.getBoundingClientRect();
    const x = start.right - outer.x;
    const y = start.bottom - outer.y;

    await commands.drag(`#${fixture.id}`, [
      [x, y],
      [x - 5, y - 4],
      [x - 10, y - 8],
    ]);

    await frames();
    const end = fixture.area.getBoundingClientRect();

    expect([
      Math.abs(end.right - (start.right - 10)) < 1.5,
      Math.abs(end.bottom - (start.bottom - 8)) < 1.5,
    ]).toStrictEqual([true, true]);
  });

  it("two wheels in one frame keep the pixel under the cursor", async () => {
    const fixture = await hosted();
    const outer = fixture.viewport.getBoundingClientRect();
    const clientX = outer.x + outer.width * 0.75;
    const clientY = outer.y + outer.height * 0.75;

    const screen = (): { x: number; y: number } => {
      const box = fixture.image.getBoundingClientRect();

      return {
        x: (clientX - box.x) / box.width,
        y: (clientY - box.y) / box.height,
      };
    };

    const before = screen();

    wheel(fixture, { clientX, clientY, ctrlKey: true, deltaY: -15 });
    wheel(fixture, { clientX, clientY, ctrlKey: true, deltaY: -15 });
    await frames();

    const after = screen();

    expect({
      point: [near(after.x, before.x, 2), near(after.y, before.y, 2)],
      zoomed: fixture.cropper.getZoom() > 1,
    }).toStrictEqual({ point: [true, true], zoomed: true });
  });
});

const frameDocument = async (): Promise<HTMLIFrameElement> => {
  const frame = document.createElement("iframe");

  frame.srcdoc = "<!doctype html><body style='margin:0'></body>";
  frame.style.cssText = "width:420px;height:320px;border:0;";

  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    document.body.append(frame);
  });

  cleanups.push(() => {
    frame.remove();
  });

  return frame;
};

const pressOn = (element: HTMLElement): void => {
  element.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 50,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
    })
  );
};

describe("a viewport in another document", () => {
  afterEach(clean);

  it("uses that document and window for images, keys, blur, layout and capture", async () => {
    const frame = await frameDocument();
    const doc = frame.contentDocument;
    const win = frame.contentWindow;

    if (!doc || !win) {
      throw new Error("no frame document");
    }

    const element = doc.createElement("div");

    element.style.cssText = "width:400px;height:300px;";
    doc.body.append(element);
    const cropper = createCropper({ image: PHOTO });
    const off = bindViewport(cropper, element);

    cleanups.push(() => {
      off();
      cropper.destroy();
    });

    const img = doc.createElement("img");

    doc.body.append(img);
    cleanups.push(bindImage(cropper, img));
    await frames();
    const states: (string | null)[] = [];

    const record = () => {
      states.push(cropper.getState().interacting);
    };

    pressOn(element);
    record();
    win.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    record();
    pressOn(element);
    globalThis.dispatchEvent(new Event("blur"));
    record();
    win.dispatchEvent(new Event("blur"));
    record();
    const wrapper = doc.createElement("div");

    doc.body.append(wrapper);
    wrapper.append(element);
    element.style.boxSizing = "content-box";
    element.style.paddingLeft = "7px";
    element.style.width = "393px";
    wrapper.dispatchEvent(new Event("transitionend", { bubbles: true }));
    const zoomed = createCropper({ image: PHOTO });
    const free = createCropper({ image: PHOTO });

    cleanups.push(() => {
      zoomed.destroy();
      free.destroy();
    });

    const control = doc.createElement("div");

    doc.body.append(control);
    const handlers = zoomHandlers(zoomed, {}, () => control);
    let threw = false;

    try {
      handlers.onPointerDown(
        new PointerEvent("pointerdown", {
          button: 0,
          buttons: 1,
          clientX: 1,
          clientY: 1,
          pointerId: 999,
        })
      );
    } catch {
      threw = true;
    }

    const track = doc.createElement("div");

    track.style.cssText = "width:200px;height:20px;";
    doc.body.append(track);
    const getterless = zoomHandlers(free);

    track.addEventListener("pointerdown", getterless.onPointerDown);

    track.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 5,
        pointerId: 1,
      })
    );

    const freeZoomed = free.getZoom() > 1;

    getterless.release();

    expect({
      captured: zoomed.getState().interacting,
      draggable: img.draggable,
      freeZoomed,
      inset: viewOf(cropper).frame()?.layout.inset.left,
      states,
      threw,
    }).toStrictEqual({
      captured: "zoom-control",
      draggable: false,
      freeZoomed: true,
      inset: 7,
      states: ["pan", null, "pan", null],
      threw: false,
    });
  });
});

describe("teardown", () => {
  afterEach(clean);

  it("leaves no window or document listeners behind", () => {
    const cropper = createCropper({ image: PHOTO });
    const element = document.createElement("div");
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");

    document.body.append(element);

    zoomHandlers(cropper, {}, () => element).onPointerDown(
      new PointerEvent("pointerdown", {
        button: 0,
        buttons: 1,
        clientX: 1,
        clientY: 1,
        pointerId: 1,
      })
    );

    cropper.destroy();
    element.remove();

    const types = (spy: typeof added | typeof removed) =>
      spy.mock.calls.map(([type]) => type).toSorted();

    const windowTypes = types(added);
    const windowRemoved = types(removed);
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const viewport = document.createElement("div");

    document.body.append(viewport);

    cleanups.push(() => {
      viewport.remove();
    });

    const other = createCropper({ image: PHOTO });
    const controller = viewportController(other);

    controller.setElement(viewport);
    const listened = add.mock.calls.length;

    controller.setElement(null);
    const documentRemoved = remove.mock.calls.slice(0, listened);
    const documentAdded = add.mock.calls.slice(0, listened);

    viewOf(other).destroy();
    other.destroy();

    expect({
      document: documentRemoved,
      documentListened: listened > 0,
      window: windowRemoved,
      windowListened: windowTypes.length > 0,
    }).toStrictEqual({
      document: documentAdded,
      documentListened: true,
      window: windowTypes,
      windowListened: true,
    });
  });
});

const bare = (css: string) => {
  const element = document.createElement("div");

  element.style.cssText = css;
  const cropper = createCropper({ image: PHOTO });

  cleanups.push(() => {
    cropper.destroy();
    element.remove();
  });

  return { cropper, element, view: viewOf(cropper) };
};

describe("a viewport's own box", () => {
  afterEach(clean);

  it("refits when only the padding changes, in the page and in a shadow tree", async () => {
    const page = bare(
      "width:400px;height:300px;padding:24px;box-sizing:content-box;"
    );
    const pageInset = () => page.view.frame()?.layout.inset.left;

    document.body.append(page.element);
    cleanups.push(bindViewport(page.cropper, page.element));
    await frames(3);
    const first = pageInset();

    page.element.style.padding = "8px";
    await until(() => pageInset() === 8);
    const host = document.createElement("div");

    document.body.append(host);
    const parent = document.createElement("div");

    parent.style.width = "400px";
    host.attachShadow({ mode: "open" }).append(parent);
    const shadow = bare(
      "width:400px;height:300px;padding:5%;box-sizing:content-box;"
    );
    const shadowInset = () => shadow.view.frame()?.layout.inset.left;

    parent.append(shadow.element);
    const off = bindViewport(shadow.cropper, shadow.element);

    cleanups.push(() => {
      off();
      host.remove();
    });

    await frames(3);
    const percent = shadowInset();

    parent.style.width = "800px";
    await until(() => shadowInset() === 40);
    expect([first, percent]).toStrictEqual([24, 20]);
  });

  it("becomes positioned when connected, viewport and dial binds give back what they wrote, and a position of its own stays", async () => {
    const late = bare("width:400px;height:300px;");

    cleanups.push(bindViewport(late.cropper, late.element));
    document.body.append(late.element);
    await until(() => getComputedStyle(late.element).position === "relative");
    const { cropper, element } = bare("width:400px;height:300px;");

    document.body.append(element);
    const off = bindViewport(cropper, element);
    const bound = element.style.position;

    off();
    const placed = bare("position:absolute;width:40px;height:30px;");

    document.body.append(placed.element);
    bindViewport(placed.cropper, placed.element)();
    const dial = bare("");

    document.body.append(dial.element);
    const unbindDial = bindDial(dial.cropper, dial.element);
    const dialBound = [
      dial.element.style.touchAction,
      dial.element.style.userSelect,
    ];

    unbindDial();

    expect({
      bound,
      dial: [
        dialBound,
        [dial.element.style.touchAction, dial.element.style.userSelect],
      ],
      own: placed.element.style.position,
      unbound: [
        element.style.position,
        element.style.touchAction,
        element.style.userSelect,
      ],
    }).toStrictEqual({
      bound: "relative",
      dial: [
        ["pan-y", "none"],
        ["", ""],
      ],
      own: "absolute",
      unbound: ["", "", ""],
    });

    await frames();
  });

  it.each([
    ["transitionend", "an ancestor", 30],
    ["animationend", "an ancestor", 30],
    ["animationend", "the viewport", 30],
    ["transitionend", "an element outside", 20],
    ["animationend", "an element outside", 20],
  ] as const)(
    "re-measures the padding on %s of %s: inset %d",
    async (type, where, inset) => {
      const fixture = mount();
      const parent = document.createElement("div");
      const outside = document.createElement("div");

      fixture.viewport.before(parent);
      parent.append(fixture.viewport);
      document.body.append(outside);

      cleanups.push(() => {
        parent.remove();
        outside.remove();
      });

      await frames();
      const view = viewOf(fixture.cropper);
      const before = view.frame()?.layout.inset.left;

      fixture.viewport.style.paddingLeft = "30px";
      const targets = {
        "an ancestor": parent,
        "an element outside": outside,
        "the viewport": fixture.viewport,
      };

      targets[where].dispatchEvent(new Event(type, { bubbles: true }));

      expect([before, view.frame()?.layout.inset.left]).toStrictEqual([
        20,
        inset,
      ]);
    }
  );
});

const keyDown = (name: string): KeyboardEvent =>
  new KeyboardEvent("keydown", { bubbles: true, code: name, key: name });

const box = (): HTMLElement => {
  const viewport = document.createElement("div");

  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  document.body.append(viewport);

  cleanups.push(() => {
    viewport.remove();
  });

  return viewport;
};

const photoCropper = (options: Parameters<typeof createCropper>[0] = {}) => {
  const cropper = createCropper({ image: PHOTO, ...options });

  cleanups.push(() => {
    viewOf(cropper).destroy();
    cropper.destroy();
  });

  return cropper;
};

describe("binding twice", () => {
  afterEach(clean);

  it("a mask with no shape keeps the shape set before it, also on a second mask", async () => {
    const shaped = createCropper();

    setCropShape(shaped, "circle");
    const stop = bindMask(shaped, document.createElement("div"));
    const kept = cropShapeOf(shaped);

    stop();
    shaped.destroy();
    const viewport = box();
    const cropper = photoCropper();
    const first = document.createElement("div");
    const second = document.createElement("div");

    viewport.append(first, second);

    cleanups.push(
      bindViewport(cropper, viewport),
      bindMask(cropper, first, "circle"),
      bindMask(cropper, second)
    );

    await frames();

    expect({
      clip: second.style.clipPath,
      kept,
      shape: cropShapeOf(cropper),
    }).toStrictEqual({
      clip: first.style.clipPath,
      kept: "circle",
      shape: "circle",
    });
  });

  it("an unbound mask leaves no clip, gradient or area radius behind", async () => {
    const viewport = box();
    const cropper = photoCropper();
    const mask = document.createElement("div");
    const area = document.createElement("div");

    mask.style.setProperty("mask-image", "none");
    viewport.append(mask, area);
    cleanups.push(bindViewport(cropper, viewport));
    const stopMask = bindMask(cropper, mask, "rect");
    const stopArea = bindArea(cropper, area, { shape: "circle" });

    await frames();
    const bound = [mask.style.clipPath !== "", area.style.borderRadius];

    stopMask();
    stopArea();

    expect({
      bound,
      unbound: [
        mask.style.clipPath,
        mask.style.getPropertyValue("mask-image"),
        area.style.borderRadius,
      ],
    }).toStrictEqual({ bound: [true, "50%"], unbound: ["", "none", ""] });
  });

  it("two binds on one area keep the frame while the newer lives and its cropper has a photo", async () => {
    const viewport = box();
    const cropper = photoCropper();
    const area = document.createElement("div");
    const visible = () => Object.hasOwn(area.dataset, "visible");

    viewport.append(area);
    cleanups.push(bindViewport(cropper, viewport));
    const stopOld = bindArea(cropper, area);

    await frames();
    const stopNew = bindArea(cropper, area);

    await frames();
    stopOld();
    const newer = visible();

    stopNew();
    const none = visible();
    const again = bindArea(cropper, area);

    await frames();
    const empty = createCropper();
    const emptyBind = bindArea(empty, area);

    await frames();
    again();
    const emptyNewer = visible();

    emptyBind();
    empty.destroy();
    expect([newer, none, emptyNewer]).toStrictEqual([true, false, false]);
  });

  it("a second dial bind or dispose leaves the other dial's options alone", () => {
    const cropper = photoCropper();
    const first = document.createElement("div");
    const second = document.createElement("div");
    const options = () => dialState(cropper).options();
    const stopFirst = bindDial(cropper, first, { gain: 2 });
    const stopSecond = bindDial(cropper, second, { gain: 2 });

    stopFirst();
    stopFirst();
    const gains = [options().gain];

    stopSecond();
    gains.push(options().gain);
    bindDial(cropper, first, { gain: 3 })();
    gains.push(options().gain);
    document.body.append(first, second);

    cleanups.push(() => {
      first.remove();
      second.remove();
    });

    const rtl = bindDial(cropper, first, { dir: "rtl" });
    const plain = bindDial(cropper, second);
    const dirs = [options().dir];

    plain();
    dirs.push(options().dir);
    rtl();
    dirs.push(options().dir);
    const stopAgain = bindDial(cropper, first);

    first.dispatchEvent(keyDown("ArrowRight"));
    const turned = cropper.getValue().rotation > 0;

    stopAgain();

    expect({ dirs, gains, turned }).toStrictEqual({
      dirs: ["rtl", "rtl", undefined],
      gains: [2, undefined, undefined],
      turned: true,
    });
  });

  it("a dial in a shadow root keeps its throw, and a release elsewhere ends it", () => {
    for (const mode of ["open", "closed"] as const) {
      const r = rig();
      const host = document.createElement("div");

      document.body.append(host);
      const dial = document.createElement("div");

      dial.style.cssText = "width:300px;height:40px;";
      host.attachShadow({ mode }).append(dial);

      cleanups.push(bindDial(r.cropper, dial), () => {
        host.remove();
      });

      const press = (end: EventTarget): void => {
        const from = performance.now();

        dial.dispatchEvent(stamped("pointerdown", 100, from));

        for (let i = 1; i <= 5; i += 1) {
          dial.dispatchEvent(
            stamped("pointermove", 100 + i * 15, from + i * 16)
          );
        }

        end.dispatchEvent(stamped("pointerup", 175, from + 80));
      };

      press(dial);
      const thrown = r.cropper.getState().interacting;

      r.time.frames(240);
      const settled = r.cropper.getState().interacting;

      press(document.body);

      expect([thrown, settled, r.cropper.getState().interacting]).toStrictEqual(
        ["dial", null, null]
      );
    }
  });
});

describe("slider attributes", () => {
  afterEach(clean);

  it("slider text never says minus zero, clamps past the end and keeps its width through a flip", () => {
    const thin = photoCropper({
      image: { height: 100, width: 4000 },
      minSize: { height: 90, width: 90 },
    });
    const dial = document.createElement("div");

    document.body.append(dial);

    cleanups.push(bindDial(thin, dial, { locale: "en" }), () => {
      dial.remove();
    });

    thin.setRotation(-0.04);
    thin.stop();
    const cropper = photoCropper();
    const zoom = document.createElement("div");

    cleanups.push(zoomAria(cropper, zoom, { locale: "en", max: 5 }));
    cropper.setZoom(10);
    cropper.stop();
    const zoomText = [
      zoom.getAttribute("aria-valuenow"),
      zoom.getAttribute("aria-valuetext"),
    ];
    const label = document.createElement("span");

    cleanups.push(bindDialValue(cropper, label));

    const read = (rotation: number): string | null => {
      cropper.setRotation(rotation);
      cropper.stop();

      return label.textContent;
    };

    expect({
      dial: [
        dial.getAttribute("aria-valuetext"),
        dial.getAttribute("aria-valuenow"),
        (dial.getAttribute("aria-valuemax")?.length ?? 9) < 5,
      ],
      label: [read(7.5), read(-7.5), read(-0.25)],
      zoom: zoomText,
    }).toStrictEqual({
      dial: ["0 degrees", "0", true],
      label: ["8", "-8", "0"],
      zoom: ["5", "1,000%"],
    });
  });

  it.each([
    ["an area", bindArea],
    ["a dial", bindDial],
    ["a zoom", zoomAria],
  ] as const)(
    "%s clears the aria-disabled it wrote when it unbinds",
    (_, bind) => {
      const cropper = photoCropper({ disabled: true });
      const element = document.createElement("div");
      const off = bind(cropper, element);
      const bound = element.getAttribute("aria-disabled");

      off();

      expect([bound, element.hasAttribute("aria-disabled")]).toStrictEqual([
        "true",
        false,
      ]);
    }
  );

  it("binders hide what screen readers have no use for", () => {
    const cropper = createCropper();
    const label = document.createElement("span");
    const named = document.createElement("span");

    named.setAttribute("aria-hidden", "false");
    const photo = document.createElement("div");

    cleanups.push(
      () => {
        cropper.destroy();
      },
      bindDialValue(cropper, label),
      bindDialValue(cropper, named),
      bindPhoto(cropper, photo)
    );

    expect([
      label.getAttribute("aria-hidden"),
      named.getAttribute("aria-hidden"),
      photo.querySelector("canvas")?.getAttribute("aria-hidden"),
    ]).toStrictEqual(["true", "false", "true"]);
  });

  it("state attributes on a root follow a gesture, the orientation and disabled", () => {
    const time = fakeClock();
    const cropper = photoCropper({ clock: time.clock });
    const root = document.createElement("div");
    const seen: Record<string, string | undefined>[] = [];

    const look = () => {
      const { disabled, orientation, resizing } = root.dataset;

      seen.push({ disabled, orientation, resizing });
    };

    cleanups.push(bindState(cropper, root));
    look();
    cropper.begin("resize");
    look();
    cropper.end();
    cropper.setAspect(2);
    look();
    cropper.setOptions({ disabled: true });
    look();
    cropper.setOptions({ disabled: false });
    look();

    expect(seen).toStrictEqual([
      { disabled: undefined, orientation: "square", resizing: undefined },
      { disabled: undefined, orientation: "square", resizing: "" },
      { disabled: undefined, orientation: "landscape", resizing: undefined },
      { disabled: "", orientation: "landscape", resizing: undefined },
      { disabled: undefined, orientation: "landscape", resizing: undefined },
    ]);
  });
});
