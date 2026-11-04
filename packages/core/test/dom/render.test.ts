import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Size } from "../../src";
import { exportImage } from "../../src/dom/export";
import type { ExportResult, LoadedImage } from "../../src/dom/image";
import { via } from "../../src/dom/worker";
import { fakeClock } from "../fake-clock";

vi.mock(import("../../src/dom/worker"), { spy: true });

const isBitmap = (value: unknown): value is ImageBitmap =>
  typeof value === "object" && value !== null && "width" in value;

const run = async (
  width: number,
  height: number,
  maxSize: Size
): Promise<ExportResult> => {
  const image = { height, width };
  if (!isBitmap(image)) {
    throw new Error("not a bitmap");
  }
  const cropper = createCropper({ clock: fakeClock().clock, image });
  const loaded: LoadedImage = {
    animated: false,
    height,
    id: 1,
    mime: "image/jpeg",
    preview: image,
    source: image,
    width,
  };
  return await exportImage(cropper, loaded, { maxSize });
};

describe("exportImage size", () => {
  beforeEach(() => {
    vi.mocked(via).mockReset();
    vi.mocked(via).mockResolvedValue({
      blob: new Blob(["x"], { type: "image/jpeg" }),
      index: 0,
    });
  });

  it("scales a crop to fit the box", async () => {
    const out = await run(900, 600, { height: 100, width: 100 });
    expect([out.width, out.height, out.scaled]).toStrictEqual([100, 66, true]);
  });

  it("reports scaled false when the one pixel floor keeps the full crop", async () => {
    const out = await run(1, 3000, { height: 100, width: 100 });
    expect([out.width, out.height, out.scaled]).toStrictEqual([1, 3000, false]);
  });

  it("ignores a box with no number in it", async () => {
    const out = await run(900, 600, { height: 100, width: Number.NaN });
    expect([out.width, out.height, out.scaled]).toStrictEqual([
      900,
      600,
      false,
    ]);
    expect(via).toHaveBeenCalledWith(
      expect.anything(),
      "render",
      [
        expect.objectContaining({
          plans: [
            expect.objectContaining({ width: 900 }),
            expect.objectContaining({ width: 450 }),
            expect.objectContaining({ width: 225 }),
          ],
        }),
      ],
      expect.anything()
    );
  });

  it("keeps the one pixel floor for an empty box", async () => {
    const out = await run(900, 600, { height: 100, width: 0 });
    expect([out.width, out.height, out.scaled]).toStrictEqual([1, 1, true]);
  });
});
