import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Size } from "../../src";
import type { LoadedImage } from "../../src/dom/image";
import { fitEdge } from "../../src/dom/media";
import { refine } from "../../src/dom/sharpen";
import type { ViewFrame } from "../../src/dom/view";
import { regionOff, resampleOff } from "../../src/dom/worker";
import type { Matrix3 } from "../../src/geometry";
import { fakeClock } from "../fake-clock";

vi.mock(import("../../src/dom/worker"), { spy: true });

const isBitmap = (value: unknown): value is ImageBitmap =>
  typeof value === "object" && value !== null && "width" in value;

const bitmap = (size: Size): ImageBitmap => {
  if (!isBitmap(size)) {
    throw new Error("not a bitmap");
  }
  return size;
};

const refined = async (
  width: number,
  height: number,
  device: number
): Promise<void> => {
  const size = { height, width };
  const image: LoadedImage = {
    ...size,
    animated: false,
    id: 1,
    mime: "image/jpeg",
    preview: bitmap(fitEdge(size, 2048)),
    source: bitmap(size),
  };
  const state = createCropper({
    clock: fakeClock().clock,
    image: size,
  }).getCropState();
  if (!state) {
    throw new Error("no state");
  }
  const matrix: Matrix3 = [device, 0, 0, 0, device, 0, 0, 0, 1];
  const frame: ViewFrame = {
    layout: {
      dpr: 1,
      height: height * device,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: width * device,
    },
    matrix,
    rect: { height: height * device, width: width * device, x: 0, y: 0 },
    scale: device,
    state,
  };
  await refine(frame, image);
};

describe(refine, () => {
  beforeEach(() => {
    vi.mocked(regionOff).mockReset();
    vi.mocked(resampleOff).mockReset();
    vi.mocked(regionOff).mockResolvedValue(bitmap({ height: 1, width: 1 }));
    vi.mocked(resampleOff).mockResolvedValue(bitmap({ height: 1, width: 1 }));
  });

  it.each([
    [4000, 3000, 0.6],
    [3, 4096, 0.6],
    [1, 4096, 1],
  ])(
    "redraws a region of a %dx%d photo above preview resolution",
    async (width, height, device) => {
      await refined(width, height, device);
      expect(regionOff).toHaveBeenCalledOnce();
    }
  );

  it("resamples a thin photo below preview resolution", async () => {
    await refined(3, 4096, 0.25);
    expect(resampleOff).toHaveBeenCalledOnce();
  });
});
