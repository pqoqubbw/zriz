import { describe, expect, it, vi } from "vitest";

import { createCropper } from "../src";
import type { CropperEvents, CropperInternals } from "../src";
import { setup as rig } from "./cropper-fixture";
import { fakeClock } from "./fake-clock";

const setup = () => rig({ image: { height: 1000, width: 1000 } });

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
    const canceller = vi.fn<CropperEvents["change"]>((_, details) => {
      details.cancel();
    });

    cropper.on("change", canceller);
    cropper.setImage({ height: 400, width: 400 });
    time.frame();
    expect(canceller).toHaveBeenCalledOnce();
    expect(cropper.getCropState()?.image.width).toBe(400);
  });

  it("scopes gestures to their owner", () => {
    const { cropper } = setup();
    const a = {};
    const b = {};
    const start = cropper.getValue().rotation;

    const refused = [
      cropper.begin("resize", undefined, a),
      cropper.begin("pan", undefined, b),
      cropper.begin("pan", undefined, {}),
    ];

    cropper.end(undefined, b);
    cropper.setRotation(9);
    cropper.cancel(undefined, b);
    const held = [cropper.getState().interacting, cropper.getValue().rotation];

    cropper.cancel(undefined, a);

    expect({
      held,
      refused,
      released: [cropper.getState().interacting, cropper.getValue().rotation],
    }).toStrictEqual({
      held: ["resize", 9],
      refused: [true, false, false],
      released: [null, start],
    });

    expect(cropper.begin("dial", undefined, b)).toBeTruthy();
  });

  it("cancels a gesture back to where it started", () => {
    const { commit, cropper, time } = setup();

    cropper.setZoom(2, { emit: false });
    const before = cropper.getValue();
    const change = vi.fn<CropperEvents["change"]>();

    cropper.on("change", change);
    cropper.begin("pan");
    cropper.panBy(0.1, 0);
    time.frame();
    cropper.cancel();
    time.frames(2);
    expect(cropper.getValue()).toStrictEqual(before);
    expect(commit).not.toHaveBeenCalled();
    expect(change.mock.calls.at(-1)?.[0]).toStrictEqual(before);

    expect(change.mock.calls.at(-1)?.[1]).toMatchObject({
      phase: "end",
      reason: "pan",
    });
  });

  it("puts the pixel crop on commit details", () => {
    const { commit, cropper, time } = setup();

    cropper.setZoom(2);
    time.frame();
    expect(commit.mock.calls[0]?.[1].pixelCrop?.width).toBeCloseTo(500, 0);
  });
});

describe("gesture and commit edges", () => {
  it("a gesture whose first frame nets out still logs start first", () => {
    const { cropper, time } = setup();

    cropper.setZoom(2);
    time.frame();
    const phases: string[] = [];

    cropper.on("change", (_, details) => {
      phases.push(details.phase);
    });

    const before = cropper.getValue();

    cropper.begin("pan");
    cropper.setValue({ ...before, center: { x: 0.6, y: 0.5 } });
    cropper.setValue(before);
    time.frame();
    cropper.setValue({ ...before, center: { x: 0.6, y: 0.5 } });
    time.frame();
    cropper.end();
    expect(phases[0]).toBe("start");
  });

  it("stop paints the value that was pending", () => {
    const { cropper } = setup();
    const painted: number[] = [];

    cropper.on("frame", ({ value }) => {
      painted.push(value.rotation);
    });

    cropper.setRotation(10);
    cropper.stop();
    expect(painted.at(-1)).toBe(10);
  });

  it("an animation a new gesture stops still reports settle", () => {
    const { cropper, time } = setup();
    const settle = vi.fn<() => void>();

    cropper.on("settle", settle);
    cropper.run(() => true);
    time.frame();
    cropper.begin("pan");
    time.frame();
    expect(settle).toHaveBeenCalledOnce();
    cropper.end();
  });

  it("two gestures in one frame commit twice", () => {
    const { commit, cropper, time } = setup();

    cropper.begin("keyboard");
    cropper.setRotation(5);
    cropper.end();
    cropper.begin("dial");
    expect(commit).toHaveBeenCalledOnce();
    cropper.setRotation(9);
    cropper.end();
    time.frame();
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("stops a run only through its own cancel", () => {
    const { cropper, time } = setup();
    const cancelled = vi.fn<() => boolean>(() => true);

    cropper.run(cancelled)();
    time.frames(2);

    expect([
      cancelled.mock.calls.length,
      cropper.getState().settling,
    ]).toStrictEqual([0, false]);

    let calls = 0;

    const once = (): boolean => {
      calls += 1;

      return calls !== 1;
    };

    const stale = cropper.run(once);

    time.frame();
    cropper.run(once);
    stale();
    time.frame();
    expect(calls).toBe(2);
    cropper.stop();

    const twice = vi.fn<() => boolean>(() => true);
    const first = cropper.run(twice);
    const second = cropper.run(twice);

    const counts: number[] = [];

    time.frame();
    counts.push(twice.mock.calls.length);
    first();
    time.frame();
    counts.push(twice.mock.calls.length);
    second();
    time.frame();
    counts.push(twice.mock.calls.length);
    expect(counts).toStrictEqual([1, 2, 2]);
    expect(cropper.getState().settling).toBeFalsy();
  });

  it("a coasting gesture ends before an outside write picks its reason", () => {
    const { commit, cropper, time } = setup();
    const owner = {};
    const release = vi.fn<() => void>(() => {
      cropper.end(undefined, owner);
    });

    cropper.begin("dial", undefined, owner);
    cropper.setRotation(5, { reason: "dial" });
    cropper.run(() => true);
    (cropper as CropperInternals).coast(owner, release);
    cropper.setRotation(6, { reason: "dial" });
    expect(release).not.toHaveBeenCalled();
    cropper.flip("x");
    expect(release).toHaveBeenCalledOnce();
    time.frame();
    expect(cropper.getState().settling).toBeFalsy();
    expect(commit.mock.calls[0]?.[1].reason).toBe("flip");
  });

  it("rebase tells a gesture about outside writes only once", () => {
    const { cropper, time } = setup();
    const owner = {};

    cropper.begin("pan", undefined, owner);
    cropper.panBy(0.01, 0, { reason: "pan" });
    expect((cropper as CropperInternals).rebase(owner)).toBeFalsy();
    cropper.setZoom(2);
    expect((cropper as CropperInternals).rebase({})).toBeFalsy();
    expect((cropper as CropperInternals).rebase(owner)).toBeTruthy();
    expect((cropper as CropperInternals).rebase(owner)).toBeFalsy();
    const zoomed = cropper.getValue();

    cropper.panBy(0.01, 0, { reason: "pan" });
    cropper.cancel(undefined, owner);
    expect(cropper.getValue()).toBe(zoomed);
    time.frame();
  });

  it("a swap under a held gesture commits the fit and rebases what comes after", () => {
    const { commit, cropper, time } = setup();
    const owner = {};

    cropper.setZoom(2);
    time.frame();
    cropper.begin("pan", undefined, owner);
    cropper.panBy(0.05, 0, { reason: "pan" });
    time.frame();
    commit.mockClear();
    cropper.setImage({ height: 2000, width: 500 });
    const [fit] = commit.mock.calls;

    expect(fit?.[1].reason).toBe("coverage");
    const fitted = cropper.getValue();

    cropper.panBy(0, 0.01, { reason: "pan" });
    cropper.end(undefined, owner);
    time.frame();
    expect(commit.mock.calls[1]?.[1].previous).toBe(fitted);
    expect(commit.mock.calls[1]?.[1].reason).toBe("pan");
  });

  it("begin, a first photo and cancel stay ready", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { aspect: 1 },
    });
    const owner = {};

    cropper.begin("pan", undefined, owner);
    cropper.setImage({ height: 1000, width: 2000 });
    cropper.setZoom(2);
    cropper.cancel(undefined, owner);
    expect(cropper.getState().ready).toBeTruthy();
    expect(cropper.getCropState()?.image.width).toBe(2000);
  });

  it("stop forgets a settle owed to an animation a gesture dropped", () => {
    const { cropper, time } = setup();
    const settle = vi.fn<() => void>();

    cropper.on("settle", settle);
    cropper.run(() => true);
    cropper.begin("pan");
    cropper.stop();
    cropper.invalidate();
    time.frame();
    expect(settle).not.toHaveBeenCalled();
  });
});
