import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, server, userEvent } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  bindDial,
  bindDialTicks,
  bindDialValue,
  bindViewport,
  dialHandlers,
  dialState,
  viewOf,
  zoomHandlers,
} from "../../src/dom";
import { PHOTO } from "../cropper-fixture";
import { fakeClock } from "../fake-clock";

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

type DialFixture = {
  id: string;
  cropper: Cropper;
  dial: HTMLElement;
  strip: HTMLElement;
  label: HTMLElement;
  commits: number;
};

const mount = (parent: HTMLElement = document.body, css = ""): DialFixture => {
  count += 1;
  const id = `dial-${count}`;
  const viewport = document.createElement("div");

  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const dial = document.createElement("div");

  dial.id = id;
  dial.setAttribute("aria-label", "Straighten");
  dial.style.cssText = `position:relative;width:361px;height:40px;overflow:hidden;${css}`;
  const strip = document.createElement("div");

  dial.append(strip);
  const label = document.createElement("span");

  parent.append(viewport, dial, label);
  const fixture: DialFixture = {
    commits: 0,
    cropper: createCropper({
      image: PHOTO,
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

describe("dial", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("turns at 4 px per degree after a 10 px slop, glides after a throw and stops at 45 degrees", async () => {
    const fixture = mount();

    await frames();

    await commands.drag(`#${fixture.id}`, [
      [180, 20],
      [185, 20],
      [190, 20],
      [210, 20],
      [230, 20],
      [230, 20, 80],
    ]);

    await expect
      .poll(
        () => [
          fixture.commits,
          Math.round(fixture.cropper.getValue().rotation),
          fixture.label.textContent,
        ],
        { timeout: 5000 }
      )
      .toStrictEqual([1, -9, "-9"]);

    fixture.cropper.setRotation(0, { emit: false });
    await frames();
    const path: [number, number][] = [[100, 20]];

    for (let i = 1; i <= 8; i += 1) {
      path.push([100 + i * 15, 20]);
    }

    await commands.drag(`#${fixture.id}`, path);
    const released = fixture.cropper.getValue().rotation;

    await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(2);
    await frames(3);
    const rested = fixture.cropper.getValue().rotation;

    expect({
      commits: fixture.commits,
      interacting: fixture.cropper.getState().interacting,
      outlasted: Math.abs(rested) >= Math.abs(released),
    }).toStrictEqual({ commits: 2, interacting: null, outlasted: true });

    fixture.cropper.setRotation(0, { emit: false });
    await frames();

    await commands.drag(`#${fixture.id}`, [
      [355, 20],
      [335, 20],
      [165, 20],
      [10, 20],
    ]);

    expect(fixture.cropper.getValue().rotation).toBe(45);

    await expect
      .poll(
        () => [
          dialState(fixture.cropper).overshoot(),
          fixture.cropper.getValue().rotation,
        ],
        { timeout: 5000 }
      )
      .toStrictEqual([0, 45]);
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
        [190, 20],
        [210, 20],
        [240, 20],
        [240, 20, 80],
      ]);

      await expect
        .poll(() => fixture.cropper.getValue().rotation)
        .toBeLessThan(-5);
    }
  );
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

const rig = () => {
  const time = fakeClock();
  const commits: string[] = [];
  const cropper = createCropper({
    clock: time.clock,
    image: PHOTO,
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

describe("dial gesture edges", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
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

  it("redraws the ruler on a dir or gain change without another input", () => {
    const f = rig();
    const offTicks = bindDialTicks(f.cropper, f.strip, 3);
    const strip = document.createElement("div");

    f.dial.append(strip);
    const offOther = bindDialTicks(f.cropper, strip, 3);

    f.cropper.setRotation(10);
    f.time.frames(2);
    const before = f.strip.style.transform;

    dialState(f.cropper).setOptions({ dir: "rtl" });
    expect(f.time.pending()).toBeGreaterThan(0);
    f.time.frames(1);
    expect(f.strip.style.transform).not.toBe(before);
    const left = strip.querySelectorAll("span")[1]?.style.left;

    expect(left).toBeDefined();

    dialState(f.cropper).setOptions({ gain: 8 });
    f.cropper.invalidate();
    f.time.frames(1);
    expect(strip.querySelectorAll("span")[1]?.style.left).not.toBe(left);
    offTicks();
    offOther();
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

  it("a key from a focusable child is left alone", () => {
    const f = rig();

    f.cropper.setRotation(10);
    const input = document.createElement("input");

    f.dial.append(input);
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "0",
    });

    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBeFalsy();
    expect(f.cropper.getValue().rotation).toBe(10);
  });
});

const escape = (): { heard: number; prevented: boolean } => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Escape",
  });
  let heard = 0;

  const listen = (): void => {
    heard += 1;
  };

  document.addEventListener("keydown", listen);
  document.body.dispatchEvent(event);
  document.removeEventListener("keydown", listen);

  return { heard, prevented: event.defaultPrevented };
};

describe("escape during a drag", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("cancels a dial or zoom drag with its stretch, stays out of a dialog and leaves a glide and a second escape to the page", () => {
    const f = rig();
    const handlers = dialHandlers(f.cropper, {}, () => f.dial);
    const before = f.cropper.getValue();

    handlers.onPointerDown(stamped("pointerdown", 100, 0));
    handlers.onPointerMove(stamped("pointermove", 180, 16));
    const turned = f.cropper.getValue().rotation !== 0;
    const first = escape();

    handlers.onPointerMove(stamped("pointermove", 200, 32));
    const after = {
      dragging: dialState(f.cropper).dragging(),
      interacting: f.cropper.getState().interacting,
      value: f.cropper.getValue(),
    };
    const second = escape();

    f.time.frames(3);

    expect({ after, commits: f.commits, first, second, turned }).toStrictEqual({
      after: { dragging: false, interacting: null, value: before },
      commits: [],
      first: { heard: 0, prevented: true },
      second: { heard: 1, prevented: false },
      turned: true,
    });

    handlers.onPointerDown(stamped("pointerdown", 100, 100));
    handlers.onPointerMove(stamped("pointermove", 700, 116));
    const stretched = dialState(f.cropper).overshoot() !== 0;

    escape();

    expect({
      overshoot: dialState(f.cropper).overshoot(),
      stretched,
    }).toStrictEqual({ overshoot: 0, stretched: true });

    handlers.onPointerDown(stamped("pointerdown", 100, 200));

    for (let i = 1; i <= 5; i += 1) {
      handlers.onPointerMove(
        stamped("pointermove", 100 + i * 15, 200 + i * 16)
      );
    }

    handlers.onPointerUp(stamped("pointerup", 175, 280));
    f.time.frames(2);
    expect(escape()).toStrictEqual({ heard: 1, prevented: false });
    f.time.frames(60);

    f.cropper.reset({ emit: false });
    f.time.frames(60);
    const track = document.createElement("div");

    track.style.cssText = "width:400px;height:20px;";
    document.body.append(track);

    cleanups.push(() => {
      track.remove();
    });

    const zoom = zoomHandlers(f.cropper, {}, () => track);
    const box = track.getBoundingClientRect();

    zoom.onPointerDown(
      new PointerEvent("pointerdown", {
        button: 0,
        buttons: 1,
        clientX: box.x + 300,
        pointerId: 2,
      })
    );

    const zoomed = f.cropper.getZoom() > 1;
    const cancel = escape();
    const back = Math.abs(f.cropper.getZoom() - 1) < 1e-9;
    const { interacting } = f.cropper.getState();

    expect({
      back,
      cancel,
      interacting,
      pass: escape(),
      zoomed,
    }).toStrictEqual({
      back: true,
      cancel: { heard: 0, prevented: true },
      interacting: null,
      pass: { heard: 1, prevented: false },
      zoomed: true,
    });
  });
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
  for (const tick of fixture.strip.querySelectorAll("span")) {
    tick.style.width = "1px";
  }
};

describe("the ruler under an ancestor or a border", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it.each([
    ["transform: scale(0.5)", "transform:scale(0.5);transform-origin:0 0;", ""],
    ["zoom: 0.5", "zoom:0.5;", ""],
    ["a scale-in that ended", "transform:scale(0.95);", ""],
    ["a border on the dial", "", "border:6px solid red;box-sizing:border-box;"],
  ])("stays centred under %s", async (_, host, dial) => {
    const parent = host ? hostOf(host) : document.body;
    const fixture = mount(parent, dial);

    styled(fixture);
    await frames();

    if (parent.style.transform === "scale(0.95)") {
      parent.style.transform = "none";
      await frames();
    }

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

    expect(Math.abs(moved - 38)).toBeLessThanOrEqual(1.5);
  });
});

const inFrame = async (): Promise<{
  frame: HTMLIFrameElement;
  doc: Document;
  win: Window;
}> => {
  const frame = document.createElement("iframe");

  frame.srcdoc = "<!doctype html><body></body>";

  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    document.body.append(frame);
  });

  const doc = frame.contentDocument;
  const win = frame.contentWindow;

  if (!doc || !win) {
    throw new Error("no document");
  }

  return { doc, frame, win };
};

describe("the ruler in another document", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("makes missing ticks and their observer from that document and lays them out", async () => {
    const { doc, frame, win } = await inFrame();
    const host = doc.createElement("div");

    host.style.cssText = "position:relative;width:200px;height:40px;";
    const strip = doc.createElement("div");

    host.append(strip);
    doc.body.append(host);
    const created = vi.spyOn(doc, "createElement");
    const observer = vi.spyOn(win, "ResizeObserver");
    const cropper = createCropper({ image: PHOTO });
    const off = bindDialTicks(cropper, strip);

    cleanups.push(() => {
      off();
      cropper.destroy();
      frame.remove();
    });

    expect(strip.children.length).toBeGreaterThan(0);
    expect(created).toHaveBeenCalledTimes(strip.children.length);
    expect(observer).toHaveBeenCalledOnce();
    await frames();
    const spans = [...strip.querySelectorAll("span")];

    expect(spans.filter((span) => span.style.left !== "")).toHaveLength(
      spans.length
    );

    expect(strip.querySelectorAll("[data-zero]")).toHaveLength(1);
  });
});
