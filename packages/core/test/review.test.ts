import { describe, expect, it, vi } from "vitest";

import { createCropper } from "../src";
import type { CropperEvents } from "../src";
import { fakeClock } from "./fake-clock";

const setup = () => {
  const time = fakeClock();
  const commit = vi.fn<CropperEvents["commit"]>();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 1000, width: 1000 },
    onValueCommit: (value, details) => {
      commit(value, details);
    },
  });
  return { commit, cropper, time };
};

describe("review regressions", () => {
  it("ignores a stale controlled echo during a gesture and still commits", () => {
    const { commit, cropper, time } = setup();
    cropper.setZoom(2, { emit: false });
    const before = cropper.getValue();
    cropper.begin("pan");
    cropper.panBy(0.05, 0);
    time.frame();
    const stale = cropper.getValue();
    cropper.panBy(0.05, 0);
    cropper.setValue(stale, { emit: false, reason: "controlled" });
    expect(cropper.getValue().center.x).toBeCloseTo(before.center.x + 0.1, 9);
    cropper.end();
    time.frame();
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[1].previous).toBe(before);
  });

  it("stays not ready for a zero-size image", () => {
    const { cropper } = setup();
    cropper.setImage({ height: 0, width: 0 });
    expect(cropper.getState().ready).toBeFalsy();
    expect(cropper.getPixelCrop()).toBeNull();
  });

  it("zooms back out to 1 after panning off-centre", () => {
    const { cropper } = setup();
    cropper.setZoom(2);
    cropper.panBy(0.2, 0);
    cropper.setZoom(1);
    expect(cropper.getZoom()).toBeCloseTo(1, 9);
    expect(cropper.getValue().center.x).toBeCloseTo(0.5, 9);
  });

  it("keeps the new image when the coverage change is cancelled", () => {
    const { cropper, time } = setup();
    cropper.setOptions({ minSize: { height: 200, width: 200 } });
    cropper.setZoom(4);
    time.frame();
    cropper.on("change", (_, details) => {
      details.cancel();
    });
    cropper.setImage({ height: 400, width: 400 });
    time.frame();
    expect(cropper.getCropState()?.image.width).toBe(400);
  });

  it("scopes gestures to their owner", () => {
    const { cropper } = setup();
    const a = {};
    const b = {};
    expect(cropper.begin("resize", undefined, a)).toBeTruthy();
    expect(cropper.begin("pan", undefined, b)).toBeFalsy();
    cropper.end(undefined, b);
    expect(cropper.getState().interacting).toBe("resize");
    cropper.end(undefined, a);
    expect(cropper.getState().interacting).toBeNull();
  });

  it("cancels a gesture back to where it started", () => {
    const { commit, cropper, time } = setup();
    cropper.setZoom(2, { emit: false });
    const before = cropper.getValue();
    cropper.begin("pan");
    cropper.panBy(0.1, 0);
    time.frame();
    cropper.cancel();
    time.frames(2);
    expect(cropper.getValue()).toStrictEqual(before);
    expect(commit).not.toHaveBeenCalled();
  });

  it("puts the pixel crop on commit details", () => {
    const { commit, cropper, time } = setup();
    cropper.setZoom(2);
    time.frame();
    expect(commit.mock.calls[0]?.[1].pixelCrop?.width).toBeCloseTo(500, 0);
  });
});
