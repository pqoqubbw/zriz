import { afterEach, describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import {
  attachImage,
  bindPhoto,
  bindViewport,
  loadImage,
  viewOf,
} from "../../src/dom";

const cleanups: (() => void)[] = [];

const stripes = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(1600, 1200);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no 2d context");
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 1600, 1200);
  context.fillStyle = "#000";
  for (let x = 0; x < 1600; x += 2) {
    context.fillRect(x, 0, 1, 1200);
  }
  return await canvas.convertToBlob({ type: "image/png" });
};

const mount = async (previewEdge: number) => {
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const photo = document.createElement("div");
  viewport.append(photo);
  document.body.append(viewport);
  const cropper = createCropper();
  const off = [bindViewport(cropper, viewport), bindPhoto(cropper, photo)];
  attachImage(cropper, await loadImage(await stripes(), { previewEdge }));
  cleanups.push(() => {
    for (const stop of off) {
      stop();
    }
    attachImage(cropper, null);
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
  });
  return { cropper, photo };
};

const sharp = async (photo: HTMLElement): Promise<void> => {
  await expect
    .poll(() => Object.hasOwn(photo.dataset, "sharp"), { timeout: 3000 })
    .toBeTruthy();
};

const contrast = (canvas: HTMLCanvasElement): number => {
  const context = canvas.getContext("2d");
  if (!context) {
    return 0;
  }
  const y = Math.floor(canvas.height / 2);
  const x = Math.floor(canvas.width / 2) - 20;
  const { data } = context.getImageData(x, y, 40, 1);
  let low = 255;
  let high = 0;
  for (let i = 0; i < data.length; i += 4) {
    low = Math.min(low, data[i] ?? 0);
    high = Math.max(high, data[i] ?? 0);
  }
  return high - low;
};

describe("photo layer", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("shows a sharp canvas at rest and the moving image during a gesture", async () => {
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    const image = photo.querySelector("img");
    expect(canvas?.style.visibility).toBe("visible");
    expect(image?.style.visibility).toBe("hidden");
    cropper.begin("pan");
    await expect
      .poll(() => image?.style.visibility, { timeout: 2000 })
      .toBe("visible");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
    cropper.end();
    await sharp(photo);
  });

  it("refreshes the region from the original past the preview's detail", async () => {
    const { cropper, photo } = await mount(400);
    cropper.setZoom(6);
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    expect(canvas ? contrast(canvas) : 0).toBeGreaterThan(150);
  });
});
