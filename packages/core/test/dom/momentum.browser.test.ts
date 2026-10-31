import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  bindArea,
  bindHandle,
  bindImage,
  bindViewport,
  viewOf,
} from "../../src/dom";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
  }
}

const cleanups: (() => void)[] = [];
let count = 0;

const raf = async (): Promise<number> =>
  await new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });

interface Stage {
  id: string;
  cropper: Cropper;
  element: HTMLElement;
  area: HTMLElement;
}

const mount = (): Stage => {
  count += 1;
  const id = `feel-${count}`;
  const element = document.createElement("div");
  element.id = id;
  element.style.cssText =
    "position:relative;width:400px;height:300px;padding:20px;box-sizing:border-box;overflow:hidden";
  const image = document.createElement("div");
  const area = document.createElement("div");
  const handle = document.createElement("div");
  handle.style.cssText =
    "position:absolute;right:-12px;bottom:-12px;width:24px;height:24px";
  area.append(handle);
  element.append(image, area);
  document.body.append(element);
  const cropper = createCropper({ image: { height: 3000, width: 4000 } });
  const off = [
    bindViewport(cropper, element),
    bindImage(cropper, image),
    bindArea(cropper, area),
    bindHandle(cropper, handle, "bottom-right"),
  ];
  cleanups.push(() => {
    for (const stop of off) {
      stop();
    }
    viewOf(cropper).destroy();
    cropper.destroy();
    element.remove();
  });
  return { area, cropper, element, id };
};

const shrink = async (stage: Stage): Promise<void> => {
  const outer = stage.element.getBoundingClientRect();
  const box = stage.area.getBoundingClientRect();
  const x = box.right - outer.left;
  const y = box.bottom - outer.top;
  await commands.drag(`#${stage.id}`, [
    [x, y],
    [x - 60, y - 40],
    [x - 120, y - 90],
  ]);
  await raf();
};

const wheel = (stage: Stage, init: WheelEventInit): void => {
  const box = stage.element.getBoundingClientRect();
  stage.element.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: box.x + 200,
      clientY: box.y + 150,
      ...init,
    })
  );
};

interface Trace {
  peak: number;
  atRelease: number;
  settledAfter: number;
  biggestStep: number;
}

const watch = async (
  stage: Stage,
  drive: () => Promise<void>
): Promise<Trace> => {
  const view = viewOf(stage.cropper);
  const size = (): number =>
    Math.hypot(view.overscroll().x, view.overscroll().y) +
    Math.abs(Math.log(view.overzoom())) * 400;
  let peak = 0;
  let previous = 0;
  let biggestStep = 0;
  const off = view.onFrame(() => {
    const now = size();
    peak = Math.max(peak, now);
    biggestStep = Math.max(biggestStep, Math.abs(now - previous));
    previous = now;
  });
  await drive();
  const atRelease = size();
  const released = performance.now();
  let settledAfter = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 120; i += 1) {
    const time = await raf();
    if (size() < 1) {
      settledAfter = time - released;
      break;
    }
  }
  off();
  return { atRelease, biggestStep, peak, settledAfter };
};

describe("feel at the limits, with a shrunk crop", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("a mouse drag past the edge springs back on release", async () => {
    const stage = mount();
    await shrink(stage);
    const trace = await watch(stage, async () => {
      await commands.drag(`#${stage.id}`, [
        [150, 120],
        [150, 220],
        [150, 290],
        [150, 299],
      ]);
    });
    expect(trace.peak).toBeGreaterThan(20);
    expect(trace.settledAfter).toBeLessThan(450);
  });

  it("trackpad scroll, with momentum, stops at the edge without overscroll", async () => {
    const stage = mount();
    await shrink(stage);
    const trace = await watch(stage, async () => {
      for (let i = 0; i < 6; i += 1) {
        wheel(stage, { deltaY: 25 });
        await raf();
      }
      let delta = 30;
      while (delta > 0.5) {
        wheel(stage, { deltaY: delta });
        delta *= 0.94;
        await raf();
      }
    });
    expect(trace.peak).toBe(0);
  });

  it("mouse wheel notches stop at the edge without overscroll", async () => {
    const stage = mount();
    await shrink(stage);
    const trace = await watch(stage, async () => {
      for (let i = 0; i < 6; i += 1) {
        wheel(stage, { deltaY: 100 });
        for (let j = 0; j < 4; j += 1) {
          await raf();
        }
      }
    });
    expect(trace.peak).toBe(0);
  });

  it("a trackpad pinch past the smallest zoom springs back after the fingers stop", async () => {
    const stage = mount();
    await shrink(stage);
    stage.cropper.setZoom(1, { emit: false });
    await raf();
    const trace = await watch(stage, async () => {
      for (let i = 0; i < 40; i += 1) {
        wheel(stage, { ctrlKey: true, deltaY: 3.7 });
        await raf();
      }
    });
    expect(trace.peak).toBeGreaterThan(5);
    expect(trace.settledAfter).toBeLessThan(450);
  });

  it("a ctrl mouse wheel past the smallest zoom springs back", async () => {
    const stage = mount();
    await shrink(stage);
    stage.cropper.setZoom(1, { emit: false });
    await raf();
    const trace = await watch(stage, async () => {
      for (let i = 0; i < 4; i += 1) {
        wheel(stage, { ctrlKey: true, deltaY: 100 });
        for (let j = 0; j < 4; j += 1) {
          await raf();
        }
      }
    });
    expect(trace.peak).toBeGreaterThan(5);
    expect(trace.settledAfter).toBeLessThan(800);
  });
});
