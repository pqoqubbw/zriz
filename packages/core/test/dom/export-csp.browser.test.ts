import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import { attachImage, exportCrop, loadImage } from "../../src/dom";

const fixture = async (name: string): Promise<Blob> => {
  const response = await fetch(new URL(`../fixtures/${name}`, import.meta.url));

  return await response.blob();
};

const workers: { failed: boolean }[] = [];

class WatchedWorker extends Worker {
  constructor(url: string | URL) {
    super(url);
    const entry = { failed: false };

    workers.push(entry);

    this.addEventListener("error", () => {
      entry.failed = true;
    });
  }
}

describe("export under a CSP that blocks blob workers", () => {
  beforeAll(() => {
    vi.stubGlobal("Worker", WatchedWorker);
    const policy = document.createElement("meta");

    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "worker-src 'none'";
    document.head.append(policy);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the main thread and still exports", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper();

    attachImage(cropper, image);
    const result = await exportCrop(cropper, { type: "image/png" });

    expect(result.type).toBe("image/png");
    const bitmap = await createImageBitmap(result.blob);

    expect([bitmap.width, bitmap.height]).toStrictEqual([
      result.width,
      result.height,
    ]);

    bitmap.close();
    expect(workers.every(({ failed }) => failed)).toBeTruthy();
    attachImage(cropper, null);
  });
});
