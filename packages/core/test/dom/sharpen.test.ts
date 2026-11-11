import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Size } from "../../src";
import { setTools } from "../../src/dom/free";
import { outputLimit, toZriz } from "../../src/dom/image";
import type { LoadedImage } from "../../src/dom/image";
import { fitEdge } from "../../src/dom/media";
import { refine } from "../../src/dom/sharpen";
import type { ViewFrame } from "../../src/dom/view";
import * as worker from "../../src/dom/worker";
import { regionOff, resampleOff } from "../../src/dom/worker";
import type { Matrix3, Point } from "../../src/geometry";
import { LAYOUT } from "../cropper-fixture";
import { fakeClock } from "../fake-clock";

vi.mock(import("../../src/dom/worker"), { spy: true });

setTools({ ...worker, outputLimit, toZriz });

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
  device: number,
  shown?: Size,
  from?: Point
): Promise<Awaited<ReturnType<typeof refine>>> => {
  const stage = shown ?? { height: height * device, width: width * device };
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

  const matrix: Matrix3 = [
    device,
    0,
    -device * (from?.x ?? 0),
    0,
    device,
    -device * (from?.y ?? 0),
    0,
    0,
    1,
  ];
  const frame: ViewFrame = {
    layout: { ...LAYOUT, height: stage.height, width: stage.width },
    matrix,
    rect: { ...stage, x: 0, y: 0 },
    scale: device,
    state,
  };

  return await refine(frame, image);
};

describe(refine, () => {
  beforeEach(() => {
    vi.mocked(regionOff).mockReset();
    vi.mocked(resampleOff).mockReset();
    vi.mocked(regionOff).mockResolvedValue(bitmap({ height: 1, width: 1 }));
    vi.mocked(resampleOff).mockResolvedValue(bitmap({ height: 1, width: 1 }));
  });

  it.each([
    [4000, 3000, 0.6, regionOff],
    [3, 4096, 0.6, regionOff],
    [1, 4096, 1, regionOff],
    [3, 4096, 0.25, resampleOff],
  ])(
    "refines a %dx%d photo at device scale %d from the right source",
    async (width, height, device, call) => {
      await refined(width, height, device);
      expect(call).toHaveBeenCalledOnce();
    }
  );

  it("cuts the resample on the left and top of a panned stage", async () => {
    const { region } = await refined(
      4096,
      3072,
      0.25,
      { height: 100, width: 200 },
      { x: 800, y: 400 }
    );

    expect(resampleOff).toHaveBeenCalledWith(
      1,
      { height: 200, width: 400, x: 400, y: 200 },
      200,
      100
    );

    expect(region).toStrictEqual({ height: 400, width: 800, x: 800, y: 400 });
  });
});
