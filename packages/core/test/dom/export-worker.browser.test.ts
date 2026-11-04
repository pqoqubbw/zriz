import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import { attachImage, exportCrop, loadImage } from "../../src/dom";

const fixture = async (name: string): Promise<Blob> => {
  const response = await fetch(new URL(`../fixtures/${name}`, import.meta.url));
  return await response.blob();
};

describe("export without workers", () => {
  beforeAll(() => {
    vi.stubGlobal("Worker", undefined);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("decodes and exports on the main thread when Worker is missing", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ defaultValue: { aspect: 1 } });
    attachImage(cropper, image);
    const result = await exportCrop(cropper, { type: "image/png" });
    expect(result.type).toBe("image/png");
    expect(result.width).toBeGreaterThan(0);
    const bitmap = await createImageBitmap(result.blob);
    expect([bitmap.width, bitmap.height]).toStrictEqual([
      result.width,
      result.height,
    ]);
    bitmap.close();
    attachImage(cropper, null);
  });
});
