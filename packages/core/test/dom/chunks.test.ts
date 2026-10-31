import { once } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { LoadedImage } from "../../src/dom/image";

const failed = (): never => {
  throw new TypeError("Failed to fetch dynamically imported module");
};

const pending = async (): Promise<never> => {
  await once(new EventTarget(), "never");
  throw new Error("unreachable");
};

const loaded: LoadedImage = {
  animated: false,
  height: 1,
  id: 1,
  mime: "image/png",
  preview: { close: () => {}, height: 1, width: 1 },
  source: new Blob(),
  width: 1,
};

const zrizError = async (): Promise<unknown> => {
  const errors = await import("../../src/dom/error");
  return errors.ZrizError;
};

const isElement = (value: unknown): value is HTMLImageElement =>
  typeof value === "object" && value !== null;

describe("lazy chunk failures", () => {
  afterEach(() => {
    vi.doUnmock("../../src/dom/render");
    vi.doUnmock("../../src/dom/svg");
    vi.doUnmock("../../src/dom/source");
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("rejects export with a ZrizError when the render chunk fails to load", async () => {
    vi.resetModules();
    vi.doMock(import("../../src/dom/render"), failed);
    const { exportImage } = await import("../../src/dom/export");
    const error: unknown = await exportImage(createCropper(), loaded).catch(
      (error_: unknown) => error_
    );
    expect(error).toBeInstanceOf(await zrizError());
  });

  it("rejects export as aborted while the render chunk is still loading", async () => {
    vi.resetModules();
    vi.doMock(import("../../src/dom/render"), pending);
    const { exportImage } = await import("../../src/dom/export");
    const controller = new AbortController();
    controller.abort();
    const error: unknown = await exportImage(createCropper(), loaded, {
      signal: controller.signal,
    }).catch((error_: unknown) => error_);
    expect(error).toBeInstanceOf(await zrizError());
    expect(error).toHaveProperty("code", "aborted");
  });

  it("rejects an svg load with a ZrizError when the svg chunk fails to load", async () => {
    vi.resetModules();
    vi.doMock(import("../../src/dom/svg"), failed);
    const { loadImage } = await import("../../src/dom/image");
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {
      type: "image/svg+xml",
    });
    const error: unknown = await loadImage(svg).catch(
      (error_: unknown) => error_
    );
    expect(error).toBeInstanceOf(await zrizError());
  });

  it("rejects an element load with a ZrizError when the source chunk fails to load", async () => {
    vi.resetModules();
    vi.doMock(import("../../src/dom/source"), failed);
    vi.stubGlobal("ImageBitmap", Map);
    const { loadImage } = await import("../../src/dom/image");
    const element: unknown = {};
    const error: unknown = isElement(element)
      ? await loadImage(element).catch((error_: unknown) => error_)
      : null;
    expect(error).toBeInstanceOf(await zrizError());
  });
});
