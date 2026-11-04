import { describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import { exportCrop, exportImage, ZrizError } from "../../src/dom";
import type { LoadedImage } from "../../src/dom";

const LOADED: LoadedImage = {
  animated: false,
  height: 1,
  id: 1,
  mime: "image/png",
  preview: { close: () => {}, height: 1, width: 1 },
  source: new Blob(),
  width: 1,
};

describe("export without a photo", () => {
  it.each([
    [
      "exportCrop before a photo loads",
      async () => await exportCrop(createCropper()),
    ],
    [
      "exportCrop from a copy of core that never got the photo",
      async () =>
        await exportCrop(createCropper({ image: { height: 300, width: 400 } })),
    ],
    [
      "exportImage on a cropper with no photo",
      async () => await exportImage(createCropper(), LOADED),
    ],
  ])("rejects %s", async (_name, run) => {
    const attempt = run();

    await expect(attempt).rejects.toBeInstanceOf(ZrizError);
    await expect(attempt).rejects.toMatchObject({ code: "no-image" });
    await expect(attempt).rejects.toThrow(/^zriz: /u);
  });
});
