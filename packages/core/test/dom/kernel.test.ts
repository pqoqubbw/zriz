import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { imageKernel } from "../../src/dom/kernel";

interface Bitmap {
  closed: number;
  width: number;
  height: number;
  close: () => void;
}

const bitmapOf = (width = 8, height = 8): Bitmap => {
  const bitmap: Bitmap = {
    close: () => {
      bitmap.closed += 1;
    },
    closed: 0,
    height,
    width,
  };
  return bitmap;
};

const RECT = { height: 8, width: 8, x: 0, y: 0 };

const decoded: Bitmap[] = [];
const canvases: FakeCanvas[] = [];
let blind = false;

class FakeCanvas {
  width: number;
  height: number;
  context = blind ? null : { drawImage: () => {} };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    canvases.push(this);
  }

  getContext(): { drawImage: () => void } | null {
    return this.context;
  }
}

const rect = { height: 4, width: 4, x: 0, y: 0 };

describe("image kernel", () => {
  beforeEach(() => {
    blind = false;
    decoded.length = 0;
    canvases.length = 0;
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    vi.stubGlobal(
      "createImageBitmap",
      async (): Promise<Bitmap> =>
        await Promise.resolve().then(() => {
          const bitmap = bitmapOf();
          decoded.push(bitmap);
          return bitmap;
        })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects motion and resample for a preview id it no longer keeps", async () => {
    const kernel = imageKernel();
    await kernel.keep(1, bitmapOf());
    await kernel.release(1);
    const released = "zriz:decode:the preview was released";
    await expect(kernel.motion(1, "image/png")).rejects.toThrow(released);
    await expect(kernel.resample(1, RECT, 8, 8)).rejects.toThrow(released);
    await expect(kernel.motion(2, "image/png")).rejects.toThrow(released);
  });

  it("closes the kept copy on release and on a second keep", async () => {
    const kernel = imageKernel();
    await kernel.keep(1, bitmapOf());
    await kernel.keep(1, bitmapOf());
    expect(decoded.map((bitmap) => bitmap.closed)).toStrictEqual([1, 0]);
    await kernel.release(1);
    expect(decoded.map((bitmap) => bitmap.closed)).toStrictEqual([1, 1]);
  });

  it("leaves a bitmap source open and frees its canvas after a region", async () => {
    const kernel = imageKernel();
    const source = bitmapOf();
    await kernel.region(source, rect, 4, 4);
    expect(source.closed).toBe(0);
    expect(canvases.map((canvas) => canvas.width)).toStrictEqual([0]);
  });

  it("closes what it decoded from a blob after a region", async () => {
    const kernel = imageKernel();
    await kernel.region(new Blob(["x"]), rect, 4, 4);
    expect(decoded[0]?.closed).toBe(1);
  });

  it("frees the canvas and the decode when there is no 2D context", async () => {
    blind = true;
    const kernel = imageKernel();
    await expect(kernel.region(new Blob(["x"]), rect, 4, 4)).rejects.toThrow(
      "zriz:decode:no 2D canvas"
    );
    expect(decoded[0]?.closed).toBe(1);
    expect(canvases.map((canvas) => canvas.width)).toStrictEqual([0]);
  });
});
