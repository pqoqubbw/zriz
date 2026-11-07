import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import { cast, isObject, loadedImage } from "../cropper-fixture";
import { deferred } from "./deferred";

const failed = (): never => {
  throw new TypeError("Failed to fetch dynamically imported module");
};

const pending = async (): Promise<never> => {
  await once(new EventTarget(), "never");
  throw new Error("unreachable");
};

const loaded = loadedImage();

const zrizError = async (): Promise<unknown> => {
  const errors = await import("../../src/dom/error");

  return errors.ZrizError;
};

const isImage = (value: unknown): value is HTMLImageElement => isObject(value);

const heldRender = () => {
  const render = vi.fn<() => Promise<never>>();
  const chunk = deferred<undefined>();

  vi.doMock(import("../../src/dom/render"), async () => {
    await chunk.promise;

    return { exportImage: render };
  });

  return { chunk, render };
};

describe("lazy chunk failures", () => {
  afterEach(() => {
    vi.doUnmock("../../src/dom/render");
    vi.doUnmock("../../src/dom/svg");
    vi.doUnmock("../../src/dom/source");
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each([
    [
      "export when the render chunk",
      "../../src/dom/render",
      async () => {
        const { exportImage } = await import("../../src/dom/export");

        return await exportImage(createCropper(), loaded);
      },
    ],
    [
      "an svg load when the svg chunk",
      "../../src/dom/svg",
      async () => {
        const { loadImage } = await import("../../src/dom/image");

        return await loadImage(
          new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {
            type: "image/svg+xml",
          })
        );
      },
    ],
    [
      "an element load when the source chunk",
      "../../src/dom/source",
      async () => {
        vi.stubGlobal("ImageBitmap", Map);
        const { loadImage } = await import("../../src/dom/image");

        return await loadImage(cast({}, isImage));
      },
    ],
  ])("rejects %s fails to load as decode", async (_name, chunk, run) => {
    vi.resetModules();
    vi.doMock(chunk, failed);
    const error: unknown = await run().catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(await zrizError());
    expect(error).toHaveProperty("code", "decode");
  });

  it.each(["before the call", "in the same tick", "during the download"])(
    "rejects an export aborted %s of the render chunk and starts no render",
    async (when) => {
      vi.resetModules();
      const { chunk, render } = heldRender();
      const { exportImage } = await import("../../src/dom/export");
      const controller = new AbortController();

      if (when === "before the call") {
        controller.abort();
      }

      const work = exportImage(createCropper(), loaded, {
        signal: controller.signal,
      });

      if (when === "during the download") {
        await delay(1);
      }

      controller.abort();
      const error: unknown = await work.catch((error_: unknown) => error_);

      expect(error).toBeInstanceOf(await zrizError());
      expect(error).toHaveProperty("code", "aborted");
      chunk.resolve(undefined);
      await delay(10);
      expect(render).not.toHaveBeenCalled();
    }
  );

  it("times out when the render chunk stalls", async () => {
    vi.resetModules();
    vi.doMock(import("../../src/dom/render"), pending);
    const { exportImage } = await import("../../src/dom/export");

    vi.useFakeTimers();
    const work = exportImage(createCropper(), loaded).catch(
      (error_: unknown) => error_
    );

    await vi.advanceTimersByTimeAsync(30_001);
    vi.useRealTimers();
    await expect(work).resolves.toHaveProperty("code", "timeout");
  });

  it("rejects as aborted when a new photo arrives during the chunk download", async () => {
    vi.resetModules();
    vi.stubGlobal("ImageBitmap", Map);
    const { chunk, render } = heldRender();
    const { exportCrop } = await import("../../src/dom/export");
    const { attachImage } = await import("../../src/dom/image-store");
    const cropper = createCropper();

    attachImage(cropper, loaded);
    const work = exportCrop(cropper);

    await delay(1);
    attachImage(cropper, { ...loaded, height: 3, id: 2 });
    chunk.resolve(undefined);
    await expect(work).rejects.toHaveProperty("code", "aborted");
    expect(render).not.toHaveBeenCalled();
  });
});
