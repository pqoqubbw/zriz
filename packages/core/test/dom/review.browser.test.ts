import { afterEach, describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import {
  bindArea,
  bindHandle,
  bindViewport,
  exportImage,
  loadImage,
  viewOf,
} from "../../src/dom";

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
