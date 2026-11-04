import { afterEach, describe, expect, it } from "vitest";
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

const mount = (): DialFixture => {
  count += 1;
  const id = `dial-${count}`;
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const dial = document.createElement("div");
  dial.id = id;
  dial.setAttribute("aria-label", "Straighten");
  dial.style.cssText =
    "position:relative;width:361px;height:40px;overflow:hidden;";
  const strip = document.createElement("div");
  dial.append(strip);
  const label = document.createElement("span");
  document.body.append(viewport, dial, label);
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
