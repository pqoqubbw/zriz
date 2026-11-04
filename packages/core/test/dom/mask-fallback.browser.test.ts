import { afterEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import { bindMask, bindViewport, setCropShape } from "../../src/dom";

const PHOTO = { height: 3000, width: 4000 };

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

describe("a circle mask without css shape()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears its gradient when the photo leaves and draws it for the next one", async () => {
    vi.spyOn(CSS, "supports").mockReturnValue(false);
    const viewport = document.createElement("div");

    viewport.style.cssText = "position:relative;width:400px;height:300px;";
    const mask = document.createElement("div");

    viewport.append(mask);
    document.body.append(viewport);
    const cropper = createCropper({ image: PHOTO });
    const off = [
      bindViewport(cropper, viewport),
      bindMask(cropper, mask, "circle"),
    ];

    await frames();
    expect(mask.style.getPropertyValue("mask-image")).not.toBe("");
    cropper.setImage(null);
    await frames();
    expect(mask.style.getPropertyValue("mask-image")).toBe("");
    expect(mask.style.getPropertyValue("-webkit-mask-image")).toBe("");
    cropper.setImage(PHOTO);
    await frames();
    expect(mask.style.getPropertyValue("mask-image")).not.toBe("");

    for (const stop of off) {
      stop();
    }

    cropper.destroy();
    viewport.remove();
  });

  it("swaps clip and gradient when the shape changes on a live bind", async () => {
    vi.spyOn(CSS, "supports").mockReturnValue(false);
    const viewport = document.createElement("div");

    viewport.style.cssText = "position:relative;width:400px;height:300px;";
    const mask = document.createElement("div");

    viewport.append(mask);
    document.body.append(viewport);
    const cropper = createCropper({ image: PHOTO });
    const off = [bindViewport(cropper, viewport), bindMask(cropper, mask)];

    await frames();
    expect(mask.style.clipPath).not.toBe("");
    setCropShape(cropper, "circle");
    cropper.invalidate();
    await frames();
    expect(mask.style.getPropertyValue("mask-image")).not.toBe("");
    expect(mask.style.clipPath).toBe("");
    setCropShape(cropper, "rect");
    cropper.invalidate();
    await frames();
    expect(mask.style.getPropertyValue("mask-image")).toBe("");
    expect(mask.style.clipPath).not.toBe("");

    for (const stop of off) {
      stop();
    }

    cropper.destroy();
    viewport.remove();
  });
});
