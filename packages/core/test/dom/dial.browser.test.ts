import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, server, userEvent } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  areaKeyHandlers,
  bindDial,
  bindDialTicks,
  bindDialValue,
  bindViewport,
  dialHandlers,
  dialState,
  viewOf,
  zoomHandlers,
} from "../../src/dom";
import type { DialHandlers, KeyHandlers } from "../../src/dom";
import { fakeClock } from "../fake-clock";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
    touch: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
  }
}

const cleanups: (() => void)[] = [];
let count = 0;

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const scrollStopped = async (): Promise<void> => {
  let still = 0;
  let last = window.scrollY;
  for (let i = 0; i < 600 && still < 5; i += 1) {
    await frames(1);
    still = window.scrollY === last ? still + 1 : 0;
    last = window.scrollY;
  }
  expect(still).toBe(5);
};

interface DialFixture {
  id: string;
  cropper: Cropper;
  dial: HTMLElement;
  strip: HTMLElement;
  label: HTMLElement;
  commits: number;
}

const mount = (parent: HTMLElement = document.body, css = ""): DialFixture => {
  count += 1;
  const id = `dial-${count}`;
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const dial = document.createElement("div");
  dial.id = id;
  dial.setAttribute("aria-label", "Straighten");
  dial.style.cssText =
    `position:relative;width:361px;height:40px;overflow:hidden;${css}`;
  const strip = document.createElement("div");
  dial.append(strip);
  const label = document.createElement("span");
  parent.append(viewport, dial, label);
  const fixture: DialFixture = {
    commits: 0,
    cropper: createCropper({
      image: { height: 3000, width: 4000 },
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    dial,
    id,
    label,
    strip,
  };
  const { cropper } = fixture;
  const unbind = [
    bindViewport(cropper, viewport),
    bindDial(cropper, dial),
    bindDialTicks(cropper, strip),
    bindDialValue(cropper, label),
  ];
  cleanups.push(() => {
    for (const off of unbind) {
      off();
    }
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
    dial.remove();
    label.remove();
  });
  return fixture;
};

const at = (clientX: number, timeStamp: number): PointerEvent => {
  const event = new PointerEvent("pointermove", {
    buttons: 1,
    clientX,
    pointerId: 1,
    pointerType: "mouse",
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
};

const turnAfter = (path: readonly (readonly [number, number])[]): number => {
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 3000, width: 4000 },
  });
  const handlers = dialHandlers(cropper);
  const [first, ...rest] = path;
  let last = first ?? [0, 0];
  handlers.onPointerDown(at(last[0], last[1]));
  for (const sample of rest) {
    handlers.onPointerMove(at(sample[0], sample[1]));
    last = sample;
  }
  handlers.onPointerUp(at(last[0], last[1] + 1));
  time.frames(200);
  const { rotation } = cropper.getValue();
  cropper.destroy();
  return rotation;
};

describe("dial release", () => {
  it("stays put when a stopped pointer twitches just before the release", () => {
    expect(
      turnAfter([
        [180, 0],
        [170, 8],
        [150, 16],
        [130, 24],
        [129, 124],
        [127, 125],
      ])
    ).toBeCloseTo(-10.75, 1);
  });

  it("still throws after a real flick", () => {
    expect(
      turnAfter([
        [100, 0],
        [115, 8],
        [130, 16],
        [145, 24],
        [160, 32],
      ])
    ).toBeGreaterThan(20);
  });
});

const arrowRight = (): KeyboardEvent =>
  new KeyboardEvent("keydown", { cancelable: true, key: "ArrowRight" });

describe("dial while another gesture or disabled blocks it", () => {
  it("leaves a key to the page when disabled, like Zoom and Area", () => {
    const cropper = createCropper({
      disabled: true,
      image: { height: 3000, width: 4000 },
    });
    const event = arrowRight();
    dialHandlers(cropper).onKeyDown(event);
    expect(event.defaultPrevented).toBeFalsy();
    cropper.destroy();
  });

  it("leaves a key to the page while another owner holds the gesture", () => {
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    expect(cropper.begin("pan", undefined, {})).toBeTruthy();
    const event = arrowRight();
    dialHandlers(cropper).onKeyDown(event);
    expect(event.defaultPrevented).toBeFalsy();
    expect(cropper.getValue().rotation).toBe(0);
    cropper.destroy();
  });

  it.each([
    [
      "a key",
      (handlers: DialHandlers) => {
        handlers.onKeyDown(arrowRight());
      },
    ],
    [
      "a press",
      (handlers: DialHandlers) => {
        handlers.onPointerDown(at(100, 100));
      },
    ],
  ])("lets a throw finish when %s is refused", (_, refused) => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const handlers = dialHandlers(cropper);
    handlers.onPointerDown(at(100, 0));
    for (let i = 1; i <= 5; i += 1) {
      handlers.onPointerMove(at(100 + i * 12, i * 8));
    }
    handlers.onPointerUp(at(160, 41));
    expect(cropper.getState().interacting).toBe("dial");
    cropper.setOptions({ disabled: true });
    refused(handlers);
    time.frames(200);
    cropper.setOptions({ disabled: false });
    expect(cropper.getState().interacting).toBeNull();
    expect(cropper.begin("pan", undefined, {})).toBeTruthy();
    cropper.destroy();
  });
});

describe.each<[string, (cropper: Cropper) => KeyHandlers]>([
  ["dial", (cropper) => dialHandlers(cropper)],
  ["zoom", (cropper) => zoomHandlers(cropper)],
  ["area", (cropper) => areaKeyHandlers(cropper)],
])("%s with a key held down", (_, handlersOf) => {
  const held = (): {
    cropper: Cropper;
    handlers: KeyHandlers;
    starts: () => number;
  } => {
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    cropper.setValue({ size: { height: 0.5, width: 0.5 } });
    let started = 0;
    cropper.on("gesturestart", () => {
      started += 1;
    });
    const handlers = handlersOf(cropper);
    const first = arrowRight();
    handlers.onKeyDown(first);
    expect(first.defaultPrevented).toBeTruthy();
    return { cropper, handlers, starts: () => started };
  };

  it("keeps one gesture over every repeat", () => {
    const { cropper, handlers, starts } = held();
    const before = cropper.getValue();
    const repeat = arrowRight();
    handlers.onKeyDown(repeat);
    expect(repeat.defaultPrevented).toBeTruthy();
    expect(cropper.getValue()).not.toStrictEqual(before);
    expect(starts()).toBe(1);
    handlers.onKeyUp(new KeyboardEvent("keyup", { key: "ArrowRight" }));
    expect(cropper.getState().interacting).toBeNull();
    cropper.destroy();
  });

  it("leaves a repeat to the page once disabled and still ends on release", () => {
    const { cropper, handlers } = held();
    cropper.setOptions({ disabled: true });
    const before = cropper.getValue();
    const repeat = arrowRight();
    handlers.onKeyDown(repeat);
    expect(repeat.defaultPrevented).toBeFalsy();
    expect(cropper.getValue()).toBe(before);
    handlers.onKeyUp(new KeyboardEvent("keyup", { key: "ArrowRight" }));
    expect(cropper.getState().interacting).toBeNull();
    cropper.destroy();
  });

  it("leaves a repeat alone under another owner after stop", () => {
    const { cropper, handlers } = held();
    cropper.stop();
    expect(cropper.begin("pan", undefined, {})).toBeTruthy();
    const before = cropper.getValue();
    const repeat = arrowRight();
    handlers.onKeyDown(repeat);
    expect(repeat.defaultPrevented).toBeFalsy();
    expect(cropper.getValue()).toBe(before);
    handlers.onKeyUp(new KeyboardEvent("keyup", { key: "ArrowRight" }));
    expect(cropper.getState().interacting).toBe("pan");
    cropper.destroy();
  });

  it("opens a new gesture when a repeat follows stop", () => {
    const { cropper, handlers, starts } = held();
    cropper.stop();
    const repeat = arrowRight();
    handlers.onKeyDown(repeat);
    expect(repeat.defaultPrevented).toBeTruthy();
    expect(cropper.getState().interacting).toBe("keyboard");
    expect(starts()).toBe(2);
    handlers.onKeyUp(new KeyboardEvent("keyup", { key: "ArrowRight" }));
    expect(cropper.getState().interacting).toBeNull();
    cropper.destroy();
  });
});

describe("dial", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("renders the iOS ruler once", () => {
    const { strip } = mount();
    const ticks = [...strip.children].filter(
      (t): t is HTMLElement => t instanceof HTMLElement
    );
    expect(ticks).toHaveLength(41);
    expect(
      ticks.flatMap((t, i) => (Object.hasOwn(t.dataset, "major") ? [i] : []))
    ).toStrictEqual([0, 10, 20, 30, 40]);
    expect(
      ticks.flatMap((t, i) => (Object.hasOwn(t.dataset, "zero") ? [i] : []))
    ).toStrictEqual([20]);
    expect(
      ticks.flatMap((t, i) => (t.dataset.fade === undefined ? [] : [i]))
    ).toStrictEqual([0, 1, 2, 38, 39, 40]);
  });

  it("turns 1:1 at 4 px per degree after a 10 px slop, left is counter-clockwise", async () => {
    const fixture = mount();
    await frames();
    await commands.drag(`#${fixture.id}`, [
      [180, 20],
      [175, 20],
      [170, 20],
      [150, 20],
      [130, 20],
      [130, 20, 80],
    ]);
    await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);
    expect(fixture.cropper.getValue().rotation).toBeCloseTo(-10, 0);
    await expect.poll(() => fixture.label.textContent).toBe("-10");
  });

  it("keeps turning after a throw and commits once when it stops", async () => {
    const fixture = mount();
    await frames();
    const path: [number, number][] = [[100, 20]];
    for (let i = 1; i <= 8; i += 1) {
      path.push([100 + i * 15, 20]);
    }
    await commands.drag(`#${fixture.id}`, path);
    const released = fixture.cropper.getValue().rotation;
    await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);
    await frames(3);
    const rested = fixture.cropper.getValue().rotation;
    expect(Math.abs(rested)).toBeGreaterThanOrEqual(Math.abs(released));
    expect(fixture.commits).toBe(1);
    expect(fixture.cropper.getState().interacting).toBeNull();
  });

  it("stops at 45 degrees and springs the ruler back", async () => {
    const fixture = mount();
    await frames();
    await commands.drag(`#${fixture.id}`, [
      [10, 20],
      [30, 20],
      [200, 20],
      [355, 20],
    ]);
    expect(fixture.cropper.getValue().rotation).toBe(45);
    await expect
      .poll(() => dialState(fixture.cropper).overshoot(), { timeout: 5000 })
      .toBe(0);
    expect(fixture.cropper.getValue().rotation).toBe(45);
  });

  it("still springs the ruler back when a key is pressed during the bounce", async () => {
    const fixture = mount();
    await frames();
    fixture.dial.focus();
    let bounce = 0;
    fixture.dial.addEventListener("pointerup", () => {
      bounce = dialState(fixture.cropper).overshoot();
      for (const type of ["keydown", "keyup"]) {
        fixture.dial.dispatchEvent(
          new KeyboardEvent(type, { bubbles: true, key: "ArrowLeft" })
        );
      }
    });
    await commands.drag(`#${fixture.id}`, [
      [10, 20],
      [30, 20],
      [200, 20],
      [355, 20],
    ]);
    await expect.poll(() => bounce).not.toBe(0);
    await expect
      .poll(() => dialState(fixture.cropper).overshoot(), { timeout: 5000 })
      .toBe(0);
    expect(fixture.cropper.getValue().rotation).toBe(44);
  });

  it("follows the slider keys and speaks the value", async () => {
    const fixture = mount();
    await frames();
    fixture.dial.focus();
    const seen: number[] = [];
    for (const key of [
      "{ArrowRight}",
      "{ArrowRight}",
      "{PageUp}",
      "{End}",
      "{Home}",
      "0",
      "{ArrowLeft}",
    ]) {
      await userEvent.keyboard(key);
      seen.push(fixture.cropper.getValue().rotation);
    }
    expect(seen).toStrictEqual([1, 2, 12, 45, -45, 0, -1]);
    await frames();
    expect(fixture.dial.getAttribute("aria-valuetext")).toBe("-1 degree");
    expect(fixture.dial.getAttribute("role")).toBe("slider");
  });

  it("centres the middle tick and fits every tick in 361 px", async () => {
    const style = document.createElement("style");
    style.textContent = "[id^='dial-'] span { width: 1px; height: 10px; }";
    document.head.append(style);
    const fixture = mount();
    await frames(3);
    const host = fixture.dial.getBoundingClientRect();
    const ticks = [...fixture.strip.children].map((tick) =>
      tick.getBoundingClientRect()
    );
    const middle = ticks[(ticks.length - 1) / 2];
    style.remove();
    expect(ticks).toHaveLength(41);
    expect(ticks[0]?.left).toBeGreaterThanOrEqual(host.left);
    expect(ticks.at(-1)?.right).toBeLessThanOrEqual(host.right);
    expect((middle?.left ?? 0) + 0.5).toBeCloseTo(
      host.left + host.width / 2,
      6
    );
  });

  it("snaps the ruler to device pixels", async () => {
    const fixture = mount();
    fixture.cropper.setRotation(3.3);
    await frames(3);
    const match = /translateX\((?<x>[-\d.e]+)px\)/u.exec(
      fixture.strip.style.transform
    );
    const x = Number(match?.groups?.x);
    const dpr = devicePixelRatio;
    expect(Math.abs(x * dpr - Math.round(x * dpr))).toBeLessThan(1e-6);
  });

  it.runIf(server.browser === "chromium")(
    "lets a vertical swipe scroll the page and turns on a horizontal one",
    async () => {
      const fixture = mount();
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      document.body.append(spacer);
      cleanups.push(() => {
        spacer.remove();
        window.scrollTo(0, 0);
      });
      window.scrollTo(0, 0);
      await frames();
      await commands.touch(`#${fixture.id}`, [
        [180, 30],
        [180, 20],
        [180, 5],
        [181, -40],
        [181, -90],
      ]);
      await expect.poll(() => window.scrollY).toBeGreaterThan(0);
      expect(fixture.cropper.getValue().rotation).toBe(0);
      await scrollStopped();
      window.scrollTo(0, 0);
      await frames();
      await commands.touch(`#${fixture.id}`, [
        [180, 20],
        [170, 20],
        [150, 20],
        [120, 20],
        [120, 20, 80],
      ]);
      await expect
        .poll(() => fixture.cropper.getValue().rotation)
        .toBeLessThan(-5);
    }
  );
});

const dialEvent = (clientX: number): PointerEvent =>
  new PointerEvent("pointermove", { button: 0, clientX, pointerId: 1 });

describe("dial options with no usable number", () => {
  const element = document.createElement("div");

  it.each([
    ["gain", { gain: 0 }],
    ["tau", { tau: 0 }],
    ["gain", { gain: Number.NaN }],
    ["tau", { tau: -1 }],
  ])("falls back to the default %s", async (_, options) => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    cleanups.push(() => {
      cropper.destroy();
    });
    const handlers = dialHandlers(cropper, options, () => element);
    handlers.onPointerDown(dialEvent(100));
    for (const x of [130, 160, 190, 220]) {
      handlers.onPointerMove(dialEvent(x));
      await frames(1);
    }
    handlers.onPointerUp(dialEvent(220));
    time.frames(2000);
    expect(Number.isFinite(cropper.getValue().rotation)).toBeTruthy();
    expect(Number.isFinite(cropper.getValue().center.x)).toBeTruthy();
    expect(Number.isNaN(dialState(cropper).overshoot())).toBeFalsy();
    expect(cropper.getState().settling).toBeFalsy();
  });
});

const stamped = (type: string, clientX: number, timeStamp: number) => {
  const event = new PointerEvent(type, {
    buttons: 1,
    clientX,
    pointerId: 2,
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
};

const down = (name: string, init = {}) =>
  new KeyboardEvent("keydown", { cancelable: true, key: name, ...init });

const rig = () => {
  const time = fakeClock();
  const commits: string[] = [];
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 3000, width: 4000 },
    onValueCommit: (_, details) => {
      commits.push(details.reason);
    },
  });
  const dial = document.createElement("div");
  dial.style.cssText = "position:relative;width:361px;height:40px;";
  const strip = document.createElement("div");
  dial.append(strip);
  const span = document.createElement("span");
  strip.append(span);
  document.body.append(dial);
  const off = bindDial(cropper, dial);
  cleanups.push(() => {
    off();
    cropper.destroy();
    dial.remove();
  });
  return { commits, cropper, dial, span, strip, time };
};

const fire = (
  target: EventTarget,
  type: string,
  x: number,
  y = 20,
  init: PointerEventInit = {}
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      ...init,
    })
  );

const key = (target: EventTarget, type: string, name: string, init = {}) => {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key: name,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

describe("dial gesture edges", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("a key tapped during a drag leaves the drag alone, in either order", () => {
    const f = rig();
    fire(f.dial, "pointerdown", 100);
    fire(f.dial, "pointermove", 160);
    const event = key(f.dial, "keydown", "ArrowRight");
    expect(event.defaultPrevented).toBeTruthy();
    key(f.dial, "keyup", "ArrowRight");
    f.time.frames(2);
    expect(f.cropper.getState().interacting).toBe("dial");
    expect(f.commits).toStrictEqual([]);
    fire(f.dial, "pointerup", 160);
    f.time.frames(2);
    expect(f.commits).toHaveLength(1);

    const g = rig();
    key(g.dial, "keydown", "ArrowRight");
    fire(g.dial, "pointerdown", 100);
    fire(g.dial, "pointermove", 160);
    key(g.dial, "keyup", "ArrowRight");
    g.time.frames(2);
    expect(g.cropper.getState().interacting).toBe("dial");
    fire(g.dial, "pointerup", 160);
  });

  it("a lost capture on a child keeps the touch on the dial", () => {
    const f = rig();
    const touch = { pointerType: "touch" };
    fire(f.span, "pointerdown", 100, 20, touch);
    fire(f.span, "pointermove", 110, 20, touch);
    fire(f.span, "lostpointercapture", 110, 20, touch);
    expect(f.cropper.getState().interacting).toBe("dial");
    fire(f.dial, "pointermove", 180, 20, touch);
    expect(f.cropper.getValue().rotation).not.toBe(0);
    fire(f.dial, "lostpointercapture", 180, 20, touch);
    expect(f.cropper.getState().interacting).toBeNull();
  });

  it("a touch that went horizontal stays on the dial while it drifts", () => {
    const f = rig();
    const touch = { pointerType: "touch" };
    fire(f.dial, "pointerdown", 100, 20, touch);
    fire(f.dial, "pointermove", 107, 21, touch);
    fire(f.dial, "pointermove", 108, 30, touch);
    expect(f.cropper.getState().interacting).toBe("dial");
    fire(f.dial, "pointerup", 108, 30, touch);
  });

  it("changes during a drag carry the pointer event", () => {
    const f = rig();
    const events: (Event | undefined)[] = [];
    f.cropper.on("change", (_, details) => {
      events.push(details.event);
    });
    fire(f.dial, "pointerdown", 100);
    fire(f.dial, "pointermove", 160);
    f.time.frames(1);
    expect(events[0]?.type).toBe("pointermove");
    fire(f.dial, "pointerup", 160);
  });

  it("a write during a drag survives the next move", () => {
    const f = rig();
    fire(f.dial, "pointerdown", 100);
    fire(f.dial, "pointermove", 160);
    f.cropper.setZoom(3, { reason: "zoom-control" });
    const { rotation } = f.cropper.getValue();
    fire(f.dial, "pointermove", 164);
    expect(f.cropper.getZoom()).toBeGreaterThan(2);
    expect(f.cropper.getValue().rotation).toBeCloseTo(rotation + 1, 6);
    fire(f.dial, "pointerup", 164);
  });

  it("a write during a glide stops the glide and keeps its reason", () => {
    const f = rig();
    const handlers = dialHandlers(f.cropper);
    handlers.onPointerDown(stamped("pointerdown", 100, 0));
    for (let i = 1; i <= 5; i += 1) {
      handlers.onPointerMove(stamped("pointermove", 100 + i * 15, i * 16));
    }
    handlers.onPointerUp(stamped("pointerup", 175, 80));
    f.time.frames(3);
    expect(f.cropper.getState().interacting).toBe("dial");
    const reasons: string[] = [];
    f.cropper.on("change", (_, details) => {
      reasons.push(details.reason);
    });
    f.cropper.reset();
    expect(f.cropper.getState().interacting).toBeNull();
    f.time.frames(30);
    expect(f.cropper.getValue().rotation).toBe(0);
    expect(reasons).toStrictEqual(["reset"]);
    expect(viewOf(f.cropper).chrome().transition).toBeNull();
  });

  it("a press during a bounce past the limit lets the ruler settle", () => {
    const f = rig();
    const handlers = dialHandlers(f.cropper);
    f.cropper.setRotation(20);
    f.time.frames(1);
    handlers.onPointerDown(stamped("pointerdown", 100, 0));
    for (let i = 1; i <= 5; i += 1) {
      handlers.onPointerMove(stamped("pointermove", 100 + i * 20, i * 16));
    }
    handlers.onPointerUp(stamped("pointerup", 200, 80));
    f.time.frames(6);
    expect(dialState(f.cropper).overshoot()).not.toBe(0);
    handlers.onPointerDown(stamped("pointerdown", 200, 200));
    handlers.onPointerUp(stamped("pointerup", 200, 201));
    f.time.frames(120);
    expect(dialState(f.cropper).overshoot()).toBe(0);
  });

  it("grabbing the dial again keeps the ruler where it was", () => {
    const f = rig();
    fire(f.dial, "pointerdown", 100);
    fire(f.dial, "pointermove", 500);
    fire(f.dial, "pointerup", 500);
    f.time.frames(2);
    const over = dialState(f.cropper).overshoot();
    expect(over).toBeGreaterThan(20);
    fire(f.dial, "pointerdown", 300);
    fire(f.dial, "pointermove", 312);
    expect(dialState(f.cropper).overshoot()).toBeGreaterThan(over * 0.8);
    fire(f.dial, "pointerup", 312);
  });

  it("a settle on one dial leaves another dial's drag alone", () => {
    const f = rig();
    const other = dialHandlers(f.cropper);
    fire(f.dial, "pointerdown", 100);
    fire(f.dial, "pointermove", 500);
    fire(f.dial, "pointerup", 500);
    f.time.frames(2);
    other.onPointerDown(stamped("pointerdown", 100, 0));
    other.onPointerMove(stamped("pointermove", 130, 8));
    f.time.frames(3);
    expect(dialState(f.cropper).dragging()).toBeTruthy();
    other.onPointerUp(stamped("pointerup", 130, 9));
  });

  it("a dir change redraws the ruler without another input", () => {
    const f = rig();
    const offTicks = bindDialTicks(f.cropper, f.strip, 3);
    f.cropper.setRotation(10);
    f.time.frames(2);
    const before = f.strip.style.transform;
    dialState(f.cropper).setOptions({ dir: "rtl" });
    expect(f.time.pending()).toBeGreaterThan(0);
    f.time.frames(1);
    expect(f.strip.style.transform).not.toBe(before);
    offTicks();
  });

  it("ticks follow a later gain", () => {
    const f = rig();
    const strip = document.createElement("div");
    f.dial.append(strip);
    const off = bindDialTicks(f.cropper, strip, 3);
    dialState(f.cropper).setOptions({ gain: 8 });
    f.cropper.invalidate();
    f.time.frames(1);
    expect(strip.querySelectorAll("span")[1]?.style.left).toBe("18px");
    off();
  });

  it("rebinding the ticks takes a new count, and cleanup takes its spans", () => {
    const f = rig();
    const strip = document.createElement("div");
    f.dial.append(strip);
    bindDialTicks(f.cropper, strip)();
    expect(strip.children).toHaveLength(0);
    const off = bindDialTicks(f.cropper, strip, 21);
    expect(strip.children).toHaveLength(21);
    off();
  });

  it("modified keys stay with the browser", () => {
    const f = rig();
    f.cropper.setRotation(10);
    for (const init of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
    ]) {
      for (const name of ["0", "ArrowLeft", "Home"]) {
        expect(key(f.dial, "keydown", name, init).defaultPrevented).toBeFalsy();
        key(f.dial, "keyup", name, init);
      }
    }
    expect(f.cropper.getValue().rotation).toBe(10);
  });

  it("a key from a focusable child is left alone", () => {
    const f = rig();
    f.cropper.setRotation(10);
    const input = document.createElement("input");
    f.dial.append(input);
    expect(key(input, "keydown", "0").defaultPrevented).toBeFalsy();
    expect(f.cropper.getValue().rotation).toBe(10);
  });

  it("a held arrow commits once when shift comes up", () => {
    const f = rig();
    key(f.dial, "keydown", "ArrowRight");
    f.time.frames(1);
    key(f.dial, "keyup", "Shift");
    f.time.frames(1);
    key(f.dial, "keydown", "ArrowRight", { repeat: true });
    key(f.dial, "keyup", "ArrowRight");
    f.time.frames(1);
    expect(f.commits).toHaveLength(1);
  });

  it("a key before any photo starts nothing", () => {
    const f = rig();
    f.cropper.setImage(null);
    expect(key(f.dial, "keydown", "ArrowRight").defaultPrevented).toBeFalsy();
    expect(f.cropper.getState().interacting).toBeNull();
  });
});

describe("zoom and area keys", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("browser shortcuts on the area keep the crop", () => {
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    cropper.setZoom(2);
    const before = cropper.getValue();
    const keys = areaKeyHandlers(cropper);
    for (const init of [{ metaKey: true }, { ctrlKey: true }]) {
      for (const name of ["0", "=", "-", "ArrowLeft"]) {
        const event = down(name, init);
        keys.onKeyDown(event);
        expect(event.defaultPrevented).toBeFalsy();
      }
    }
    for (const name of ["0", "=", "-"]) {
      const event = down(name, { altKey: true });
      keys.onKeyDown(event);
      expect(event.defaultPrevented).toBeFalsy();
    }
    expect(cropper.getValue()).toBe(before);
    const resize = down("ArrowRight", { altKey: true });
    keys.onKeyDown(resize);
    expect(resize.defaultPrevented).toBeTruthy();
  });

  it("modified keys on zoom stay with the browser", () => {
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    cropper.setZoom(2);
    const before = cropper.getValue();
    const keys = zoomHandlers(cropper);
    for (const init of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
    ]) {
      const event = down("ArrowLeft", init);
      keys.onKeyDown(event);
      expect(event.defaultPrevented).toBeFalsy();
    }
    expect(cropper.getValue()).toBe(before);
  });

  it("a zoom press or key before any photo starts nothing", () => {
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    cropper.setImage(null);
    const keys = zoomHandlers(cropper);
    keys.onKeyDown(down("ArrowRight"));
    keys.onPointerDown(new PointerEvent("pointerdown", { pointerId: 1 }));
    expect(cropper.getState().interacting).toBeNull();
  });
});

describe("the ruler under an ancestor or a border", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  const offCentre = (fixture: DialFixture): number => {
    const zero = fixture.strip.querySelector("[data-zero]");
    const tick = zero?.getBoundingClientRect();
    const box = fixture.dial.getBoundingClientRect();
    return (tick?.x ?? 0) + (tick?.width ?? 0) / 2 - (box.x + box.width / 2);
  };

  const hostOf = (css: string): HTMLElement => {
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:0;top:0;width:361px;${css}`;
    document.body.append(host);
    cleanups.push(() => {
      host.remove();
    });
    return host;
  };

  const styled = (fixture: DialFixture): void => {
    for (const tick of fixture.strip.children) {
      (tick as HTMLElement).style.width = "1px";
    }
  };

  it("stays centred after a scale-in ends", async () => {
    const host = hostOf("transform:scale(0.95);");
    const fixture = mount(host);
    styled(fixture);
    await frames();
    host.style.transform = "none";
    await frames();
    expect(Math.abs(offCentre(fixture))).toBeLessThanOrEqual(1);
  });

  it.each([
    ["transform: scale(0.5)", "transform:scale(0.5);transform-origin:0 0;"],
    ["zoom: 0.5", "zoom:0.5;"],
  ])("stays centred under %s", async (_, css) => {
    const fixture = mount(hostOf(css));
    styled(fixture);
    await frames();
    expect(Math.abs(offCentre(fixture))).toBeLessThanOrEqual(1);
  });

  it("stays centred with a border on the dial", async () => {
    const fixture = mount(
      document.body,
      "border:6px solid red;box-sizing:border-box;"
    );
    styled(fixture);
    await frames();
    expect(Math.abs(offCentre(fixture))).toBeLessThanOrEqual(1);
  });

  it.each([
    ["transform: scale(0.5)", "transform:scale(0.5);transform-origin:0 0;"],
    ["zoom: 0.5", "zoom:0.5;"],
  ])("moves the ruler with the pointer under %s", async (_, css) => {
    const fixture = mount(hostOf(css));
    styled(fixture);
    await frames();
    const zero = fixture.strip.querySelector("[data-zero]");
    const before = zero?.getBoundingClientRect().x ?? 0;
    await commands.drag(`#${fixture.id}`, [
      [40, 10],
      [60, 10],
      [90, 10],
      [90, 10, 150],
    ]);
    await frames();
    const moved = (zero?.getBoundingClientRect().x ?? 0) - before;
    expect(Math.abs(moved - 40)).toBeLessThanOrEqual(1.5);
  });
});

describe("the ruler in another document", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("lays out ticks made by that document", async () => {
    const frame = document.createElement("iframe");
    frame.srcdoc = "<!doctype html><body></body>";
    await new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      document.body.append(frame);
    });
    const doc = frame.contentDocument as Document;
    const host = doc.createElement("div");
    host.style.cssText = "position:relative;width:200px;height:40px;";
    const strip = doc.createElement("div");
    for (let i = 0; i < 41; i += 1) {
      strip.append(doc.createElement("span"));
    }
    host.append(strip);
    doc.body.append(host);
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    const off = bindDialTicks(cropper, strip);
    cleanups.push(() => {
      off();
      cropper.destroy();
      frame.remove();
    });
    await frames();
    const spans = [...strip.children] as HTMLElement[];
    expect(spans.filter((span) => span.style.left !== "")).toHaveLength(41);
    expect(strip.querySelectorAll("[data-zero]")).toHaveLength(1);
  });
});

describe("bindDial on an element", () => {
  it("clears the tap highlight and gets its styles back after", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const cropper = createCropper({ image: { height: 3000, width: 4000 } });
    const off = bindDial(cropper, element);
    expect(element.style.touchAction).toBe("pan-y");
    expect(element.style.userSelect).toBe("none");
    off();
    expect(element.style.touchAction).toBe("");
    expect(element.style.userSelect).toBe("");
    cropper.destroy();
    element.remove();
  });
});
