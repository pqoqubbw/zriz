import { setTimeout as delay } from "node:timers/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Size } from "../../src";
import type { LoadedImage } from "../../src/dom/image";
import { fitEdge } from "../../src/dom/media";
import { refine } from "../../src/dom/sharpen";
import type { ViewFrame } from "../../src/dom/view";
import { regionOff, resampleOff } from "../../src/dom/worker";
import type { Matrix3, Point } from "../../src/geometry";
import { fakeClock } from "../fake-clock";
import { deferred } from "./deferred";

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
  device: number,
  shown?: Size,
  live?: () => boolean,
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
    layout: {
      dpr: 1,
      height: stage.height,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: stage.width,
    },
    matrix,
    rect: { ...stage, x: 0, y: 0 },
    scale: device,
    state,
  };

  return await refine(frame, image, live);
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

  it("resamples only what the stage shows", async () => {
    await refined(2048, 1536, 0.5, { height: 100, width: 200 });

    expect(resampleOff).toHaveBeenCalledWith(
      1,
      { height: 200, width: 400, x: 0, y: 0 },
      200,
      100
    );
  });

  it("cuts the resample on the left and top of a panned stage", async () => {
    const { region } = await refined(
      4096,
      3072,
      0.25,
      { height: 100, width: 200 },
      undefined,
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

  it("skips the original when the frame went stale in the line", async () => {
    await refined(4000, 3000, 0.6, undefined, () => false);
    expect(regionOff).not.toHaveBeenCalled();
  });

  it("takes a decode turn for each region", async () => {
    const held = deferred<ImageBitmap>();

    vi.mocked(regionOff).mockImplementation(async () => await held.promise);
    const jobs = Array.from({ length: 5 }, async () => {
      await refined(4000, 3000, 0.6);
    });

    await vi.waitFor(() => {
      expect(regionOff).toHaveBeenCalledTimes(3);
    });

    await delay(10);
    expect(regionOff).toHaveBeenCalledTimes(3);
    held.resolve(bitmap({ height: 1, width: 1 }));
    await Promise.all(jobs);
    expect(regionOff).toHaveBeenCalledTimes(5);
  });
});
