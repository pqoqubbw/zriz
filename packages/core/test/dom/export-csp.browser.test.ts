import { beforeAll, describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import { attachImage, exportCrop, loadImage } from "../../src/dom";
import { renderActive } from "../../src/dom/render";
import { workerActive } from "../../src/dom/worker";

const fixture = async (name: string): Promise<Blob> => {
  const response = await fetch(new URL(`../fixtures/${name}`, import.meta.url));
  return await response.blob();
};

describe("export under a CSP that blocks blob workers", () => {
  beforeAll(() => {
    const policy = document.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "worker-src 'none'";
    document.head.append(policy);
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
    expect(workerActive()).toBeFalsy();
    expect(renderActive()).toBeFalsy();
    attachImage(cropper, null);
  });
});
