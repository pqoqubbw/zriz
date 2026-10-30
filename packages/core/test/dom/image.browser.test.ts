import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import { createCropper } from "../../src";
import {
  ZrizError,
  attachImage,
  exportCrop,
  exportImage,
  loadImage,
} from "../../src/dom";
import { workerActive } from "../../src/dom/worker";
import { workingToSource } from "../../src/geometry";
import orientations from "../fixtures/orient.json";

const expected: Record<
  string,
  { width: number; height: number; topLeft: number[] }
> = orientations;

const fixture = async (name: string): Promise<Blob> => {
  const response = await fetch(new URL(`../fixtures/${name}`, import.meta.url));
  return await response.blob();
};

const pixels = async (
  blob: Blob,
  points: readonly [number, number][]
): Promise<number[][]> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no 2d context");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
};

const near = (
  a: number[] | undefined,
  b: number[] | undefined,
  tolerance = 48
): boolean =>
  a !== undefined &&
  b !== undefined &&
  b.every((value, i) => Math.abs((a[i] ?? 0) - value) <= tolerance);

describe("load and export", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "shows and exports EXIF orientation %i upright",
    async (orientation) => {
      const want = expected[String(orientation)] ?? {
        height: 0,
        topLeft: [],
        width: 0,
      };
      const image = await loadImage(await fixture(`orient-${orientation}.jpg`));
      expect([image.width, image.height]).toStrictEqual([
        want.width,
        want.height,
      ]);
      const cropper = createCropper({ image });
      const result = await exportImage(cropper, image, { type: "image/png" });
      const [topLeft] = await pixels(result.blob, [[1, 1]]);
      expect(near(topLeft, want.topLeft)).toBeTruthy();
      image.preview.close();
    }
  );

  it("exports a straightened crop with no empty corners", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ image });
    cropper.setRotation(12);
    const result = await exportImage(cropper, image, { type: "image/png" });
    const { width, height } = result;
    const corners = await pixels(result.blob, [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ]);
    expect(corners.every((pixel) => pixel[3] === 255)).toBeTruthy();
    expect(result.type).toBe(result.blob.type);
  });

  it("gives a round PNG for a round crop", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ defaultValue: { aspect: 1 }, image });
    const result = await exportImage(cropper, image, { shape: "circle" });
    expect(result.type).toBe("image/png");
    const [corner, centre] = await pixels(result.blob, [
      [0, 0],
      [Math.floor(result.width / 2), Math.floor(result.height / 2)],
    ]);
    expect(corner?.[3]).toBe(0);
    expect(centre?.[3]).toBe(255);
  });

  it("reports the type the browser actually produced", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ image });
    const result = await exportImage(cropper, image, { type: "image/webp" });
    expect(result.type).toBe(result.blob.type);
    expect(["image/webp", "image/png"]).toContain(result.type);
  });

  it("sizes an SVG with only a viewBox from the viewBox", async () => {
    const image = await loadImage(await fixture("viewbox.svg"));
    expect(image.width / image.height).toBeCloseTo(1.5, 2);
  });

  it("throws a typed error for a format the browser cannot decode", async () => {
    const error: unknown = await loadImage(await fixture("fake.heic")).catch(
      (error_: unknown) => error_
    );
    expect(error).toBeInstanceOf(ZrizError);
    expect(["unsupported-format", "decode"]).toContain(
      error instanceof ZrizError ? error.code : ""
    );
  });

  it("throws a typed cross-origin error at load, not at export", async () => {
    const attempt = loadImage("https://zriz.invalid/photo.jpg", {
      timeout: 5000,
    });
    await expect(attempt).rejects.toMatchObject({ code: "cross-origin" });
  });

  it("decodes and exports off the main thread", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    await exportImage(createCropper({ image }), image);
    expect(workerActive()).toBeTruthy();
  });

  it("keeps the preview under its edge", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"), {
      previewEdge: 12,
    });
    expect(Math.max(image.preview.width, image.preview.height)).toBe(12);
    expect(image.width).toBe(30);
  });

  it("exports a perspective crop through the mesh", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ focalLength: 40, image });
    cropper.setValue({ perspective: { horizontal: 8, vertical: 10 } });
    const state = cropper.getCropState();
    if (!state) {
      throw new Error("no state");
    }
    const result = await exportImage(cropper, image, {
      maxSize: { height: 200, width: 200 },
      type: "image/png",
    });
    const scale = result.width / state.crop.width;
    const samples: [number, number][] = [];
    for (let u = 0.1; u < 1; u += 0.2) {
      for (let v = 0.1; v < 1; v += 0.2) {
        samples.push([
          Math.floor(u * result.width),
          Math.floor(v * result.height),
        ]);
      }
    }
    const got = await pixels(result.blob, samples);
    const misses: number[] = [];
    let checked = 0;
    for (const [i, [x, y]] of samples.entries()) {
      const source = workingToSource(state, {
        x: (x + 0.5 - result.width / 2) / scale + state.crop.x,
        y: (y + 0.5 - result.height / 2) / scale + state.crop.y,
      });
      if (Math.abs(source.x - 15) > 2 && Math.abs(source.y - 10) > 2) {
        let want = [255, 255, 255];
        if (source.x < 15 && source.y < 10) {
          want = [255, 0, 0];
        } else if (source.y < 10) {
          want = [0, 255, 0];
        } else if (source.x < 15) {
          want = [0, 0, 255];
        }
        if (!near(got[i], want)) {
          misses.push(i);
        }
        checked += 1;
      }
    }
    expect(misses).toStrictEqual([]);
    expect(checked).toBeGreaterThan(10);
  });

  it.runIf(server.browser !== "firefox")(
    "keeps a P3 source in P3",
    async () => {
      const source = new OffscreenCanvas(16, 16);
      const paint = source.getContext("2d", { colorSpace: "display-p3" });
      if (!paint) {
        throw new Error("no P3 canvas");
      }
      paint.fillStyle = "color(display-p3 1 0 0)";
      paint.fillRect(0, 0, 16, 16);
      const image = await loadImage(
        await source.convertToBlob({ type: "image/png" })
      );
      const cropper = createCropper();
      attachImage(cropper, image);
      const result = await exportCrop(cropper, {
        colorSpace: "display-p3",
        type: "image/png",
      });
      const element = new Image();
      element.src = URL.createObjectURL(result.blob);
      await element.decode();
      const canvas = new OffscreenCanvas(
        element.naturalWidth,
        element.naturalHeight
      );
      const context = canvas.getContext("2d", { colorSpace: "display-p3" });
      context?.drawImage(element, 0, 0);
      URL.revokeObjectURL(element.src);
      const pixel = context?.getImageData(4, 4, 1, 1, {
        colorSpace: "display-p3",
      }).data;
      expect([...(pixel ?? [])].slice(0, 3)).toStrictEqual([255, 0, 0]);
    }
  );
});
