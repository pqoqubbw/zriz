import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import * as core from "../src";
import { createCropper, defaultValue } from "../src";
import type { Cropper, CropperEvents } from "../src";
import * as dom from "../src/dom";
import { areaKeyHandlers } from "../src/dom/controls";
import { viewOf } from "../src/dom/view";
import {
  applyHomography,
  invertMatrix3,
  sourceToWorking,
  workingToSource,
} from "../src/geometry";
import { key, PHOTO, setup, stateOf } from "./cropper-fixture";
import { fakeClock } from "./fake-clock";
import { isCropCovered } from "./geometry/oracles";

describe("panBy", () => {
  it.each([
    [0, PHOTO.width, PHOTO.height],
    [1, PHOTO.height, PHOTO.width],
  ] as const)(
    "moves by fractions of the photo's sides after %i quarter turns",
    (turns, across, down) => {
      const { cropper } = setup({ defaultValue: { quarterTurns: turns } });

      cropper.setZoom(4);
      const before = stateOf(cropper).crop;

      cropper.panBy(0.1, 0.05);
      const after = stateOf(cropper).crop;

      expect(after.x - before.x).toBeCloseTo(0.1 * across, 6);
      expect(after.y - before.y).toBeCloseTo(0.05 * down, 6);
    }
  );
});

describe("setZoom", () => {
  it("zooms around the anchor, or the crop's centre without one", () => {
    const { cropper } = setup();

    cropper.setZoom(4, { anchor: { x: 0.25, y: 0.75 } });
    expect(cropper.getValue().center.x).toBeCloseTo(0.25 + 0.25 / 4, 9);
    expect(cropper.getValue().center.y).toBeCloseTo(0.75 - 0.25 / 4, 9);
    const { center } = cropper.getValue();

    cropper.setZoom(5);
    expect(cropper.getValue().center).toStrictEqual(center);
  });
});

describe("writes keep the centre", () => {
  it("setRotation keeps the photo point under the centre and shrinks to stay covered", () => {
    const { cropper } = setup();

    cropper.setValue({
      center: { x: 0.3, y: 0.6 },
      size: { height: 0.6, width: 0.6 },
    });

    const start = stateOf(cropper);
    const point = workingToSource(start, { x: start.crop.x, y: start.crop.y });

    cropper.setRotation(20);
    const turned = stateOf(cropper);
    const after = workingToSource(turned, {
      x: turned.crop.x,
      y: turned.crop.y,
    });

    expect(after.x).toBeCloseTo(point.x, 6);
    expect(after.y).toBeCloseTo(point.y, 6);
    expect(turned.crop.width).toBeLessThan(start.crop.width);
    expect(isCropCovered(turned, 1e-6)).toBeTruthy();
  });

  it.each([
    [
      "setValue",
      (c: Cropper) => {
        c.setValue({ rotation: 20 });
      },
    ],
    [
      "setAspect",
      (c: Cropper) => {
        c.setAspect(1);
      },
    ],
  ] as const)("%s shrinks around the crop's centre", (_, write) => {
    const { cropper } = setup();
    const center = { x: 0.3, y: 0.6 };

    cropper.setValue({ center, size: { height: 0.6, width: 0.6 } });
    write(cropper);
    expect(cropper.getValue().center).toStrictEqual(center);
    expect(isCropCovered(stateOf(cropper), 1e-6)).toBeTruthy();
  });

  it("moves a crop centred on or off the photo's edge back onto it", () => {
    const { cropper } = setup();

    cropper.setValue({
      center: { x: 1, y: 1 },
      size: { height: 0.3, width: 0.3 },
    });

    expect(cropper.getValue().center).toStrictEqual({ x: 0.85, y: 0.85 });
    expect(cropper.getValue().size).toStrictEqual({ height: 0.3, width: 0.3 });

    cropper.setValue({ center: { x: 5, y: -3 }, rotation: 12 });
    const state = stateOf(cropper);

    expect(Number.isFinite(state.crop.width)).toBeTruthy();
    expect(state.crop.width).toBeGreaterThan(0);
    expect(isCropCovered(state, 1e-6)).toBeTruthy();
  });
});

describe("minSize", () => {
  it("grows a crop below the minimum until each side holds", () => {
    const tall = setup({ minSize: { height: 400, width: 500 } }).cropper;

    tall.setValue({ size: { height: 0.05, width: 0.05 } });
    expect(stateOf(tall).crop.height).toBeCloseTo(400, 6);
    const wide = setup({ minSize: { height: 100, width: 500 } }).cropper;

    wide.setValue({ size: { height: 0.05, width: 0.05 } });
    expect(stateOf(wide).crop.width).toBeCloseTo(500, 6);
  });

  it("reports the angle the photo has room for, and setRotation obeys it", () => {
    const roomy = setup().cropper;

    roomy.setValue({ rotation: 90 });

    const tiny = setup({
      image: { height: 100, width: 40 },
      minSize: { height: 30, width: 30 },
    }).cropper;
    const cap = tiny.getRotationLimit();

    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThan(45);
    tiny.setRotation(45);
    expect(tiny.getValue().rotation).toBeCloseTo(cap, 9);

    const oversize = setup({
      defaultValue: { aspect: 1 },
      image: { height: 200, width: 300 },
      minSize: { height: 512, width: 512 },
    }).cropper;

    expect({
      oversize: [stateOf(oversize).crop.height, oversize.getRotationLimit()],
      roomy: [roomy.getRotationLimit(), roomy.getValue().rotation],
    }).toStrictEqual({
      oversize: [expect.closeTo(200, 6), 0],
      roomy: [45, 45],
    });
  });
});

describe("maxZoom", () => {
  it("defaults to 15, bounds setZoom and a value, and can go above 15", () => {
    const { cropper } = setup({ maxZoom: 2 });

    expect([setup().cropper.getMaxZoom(), cropper.getMaxZoom()]).toStrictEqual([
      15, 2,
    ]);

    cropper.setZoom(10);
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    cropper.setValue({ size: { height: 0.01, width: 0.01 } });
    expect(cropper.getZoom()).toBeLessThanOrEqual(2 + 1e-6);

    const deep = setup({ maxZoom: 30 }).cropper;

    deep.setZoom(30);
    expect(deep.getZoom()).toBeCloseTo(30, 6);
  });
});

describe("rotate90 and flip", () => {
  it.each(["ccw", "cw"] as const)(
    "turns a numeric aspect with the photo %s and leaves free alone",
    (direction) => {
      const { cropper } = setup({ defaultValue: { aspect: 4 / 3 } });

      cropper.rotate90(direction);
      expect(cropper.getValue().aspect).toBeCloseTo(3 / 4, 12);
      expect(stateOf(cropper).aspect).toBeCloseTo(3 / 4, 12);
      const { crop } = stateOf(cropper);

      expect(crop.width / crop.height).toBeCloseTo(3 / 4, 9);
      const free = setup().cropper;

      free.rotate90(direction);
      expect(free.getValue().aspect).toBe("free");
    }
  );

  it("turns counter-clockwise by default and clockwise with cw", () => {
    const right = { x: PHOTO.width, y: PHOTO.height / 2 };
    const ccw = setup().cropper;

    ccw.rotate90();
    expect(sourceToWorking(stateOf(ccw), right).y).toBeLessThan(0);
    const cw = setup().cropper;

    cw.rotate90("cw");
    expect(sourceToWorking(stateOf(cw), right).y).toBeGreaterThan(0);
  });

  it("mirrors left to right by default and top to bottom with y", () => {
    const left = { x: 0, y: PHOTO.height / 2 };
    const top = { x: PHOTO.width / 2, y: 0 };
    const x = setup().cropper;

    x.flip();
    expect(sourceToWorking(stateOf(x), left).x).toBeGreaterThan(0);
    const y = setup().cropper;

    y.flip("y");
    expect(sourceToWorking(stateOf(y), top).y).toBeGreaterThan(0);
  });
});

describe("disabled", () => {
  const writes: Record<string, (cropper: Cropper) => void> = {
    flip: (c) => {
      c.flip();
    },
    panBy: (c) => {
      c.panBy(0.1, 0.1);
    },
    reset: (c) => {
      c.reset();
    },
    rotate90: (c) => {
      c.rotate90();
    },
    setAspect: (c) => {
      c.setAspect(1);
    },
    setCropState: (c) => {
      c.setCropState({
        ...stateOf(c),
        crop: { ...stateOf(c).crop, height: 100, width: 100 },
      });
    },
    setRotation: (c) => {
      c.setRotation(30);
    },
    setZoom: (c) => {
      c.setZoom(3);
    },
  };

  it.each(Object.keys(writes))("refuses %s", (name) => {
    const { cropper } = setup({
      defaultValue: { rotation: 0 },
      value: { ...defaultValue, rotation: 5 },
    });

    cropper.setOptions({ disabled: true });
    const before = cropper.getValue();

    writes[name]?.(cropper);
    expect(cropper.getValue()).toBe(before);
  });

  it("refuses a gesture, reports itself, and takes writes again once it ends", () => {
    const { cropper } = setup({ disabled: true });

    expect(cropper.getState().disabled).toBeTruthy();

    expect([
      cropper.begin("pan"),
      cropper.getState().interacting,
    ]).toStrictEqual([false, null]);

    cropper.setOptions({ disabled: false });
    expect(cropper.getState().disabled).toBeFalsy();
    expect(cropper.begin("pan")).toBeTruthy();
    cropper.end();
    cropper.setRotation(4);
    expect(cropper.getValue().rotation).toBe(4);
  });

  it("still takes setValue, setImage and setOptions", () => {
    const { cropper } = setup({ disabled: true });

    cropper.setValue({ rotation: 7 });
    expect(cropper.getValue().rotation).toBe(7);
    cropper.setImage({ height: 500, width: 500 });
    expect(stateOf(cropper).image.width).toBe(500);
    cropper.setOptions({ maxZoom: 3 });
    expect(cropper.getMaxZoom()).toBe(3);
  });
});

describe("begin", () => {
  it("stops an animation that holds the commit, and only that one", () => {
    const { cropper, time } = setup();
    const holds = vi.fn<() => boolean>(() => true);
    const free = vi.fn<() => boolean>(() => true);

    cropper.run(holds);
    cropper.run(free, false);
    cropper.begin("pan");
    time.frames(2);
    expect(holds).not.toHaveBeenCalled();
    expect(free).toHaveBeenCalledTimes(2);
    cropper.end();
  });
});

const pressArea = (cropper: Cropper, name: string, shiftKey = false): void => {
  const handlers = areaKeyHandlers(cropper);
  const event = key({ key: name, shiftKey });

  handlers.onKeyDown(event);
  handlers.onKeyUp(event);
};

describe("reset", () => {
  it("goes to defaultValue with or without a photo, past the value option, and on 0", () => {
    const empty = createCropper({
      clock: fakeClock().clock,
      defaultValue: { rotation: 3 },
    });

    empty.setValue({ rotation: 10 });
    empty.reset();
    expect(empty.getValue().rotation).toBe(3);

    const started = setup({
      defaultValue: { rotation: 3 },
      value: { ...defaultValue, rotation: 10 },
    }).cropper;

    expect(started.getValue().rotation).toBe(10);
    started.reset();
    expect(started.getValue().rotation).toBe(3);

    const { cropper } = setup({
      defaultValue: {
        center: { x: 0.3, y: 0.6 },
        rotation: 20,
        size: { height: 0.6, width: 0.6 },
      },
    });
    const start = cropper.getValue();

    cropper.setAspect(1);
    cropper.setZoom(3);
    cropper.reset();
    expect(cropper.getValue()).toStrictEqual(start);
    cropper.setZoom(4);
    pressArea(cropper, "0");
    expect(cropper.getValue()).toStrictEqual(start);
  });
});

describe("setOptions", () => {
  it("refits the crop to new limits with reason coverage and stays pristine", () => {
    const { change, cropper, time } = setup({
      defaultValue: { size: { height: 0.1, width: 0.1 } },
    });

    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setOptions({ maxZoom: 2 });
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    expect(cropper.getState().pristine).toBeTruthy();
    time.frame();
    expect(change.mock.calls[0]?.[1].reason).toBe("coverage");
  });
});

describe("setImage", () => {
  it("counts null and a size that is not finite and positive as no photo", () => {
    for (const size of [
      null,
      { height: Number.POSITIVE_INFINITY, width: 10 },
      { height: 10, width: Number.POSITIVE_INFINITY },
      { height: Number.NaN, width: 10 },
      { height: 10, width: -1 },
      { height: 0, width: 10 },
      { height: 10, width: 0 },
      { height: 0, width: 0 },
    ]) {
      const { cropper } = setup();

      cropper.setImage(size);
      expect(cropper.getCropState()).toBeNull();
      expect(cropper.getPixelCrop()).toBeNull();
      expect(cropper.getState().ready).toBeFalsy();
      expect(cropper.getZoom()).toBe(1);
    }
  });
});

describe("change details", () => {
  it("carry previous, event, reason, phase and isCanceled", () => {
    const { change, commit, cropper, time } = setup();
    const event = new Event("x");

    cropper.setRotation(3, { event, reason: "history" });
    time.frame();
    const first = cropper.getValue();

    expect(change.mock.calls[0]?.[1]).toMatchObject({
      event,
      phase: "instant",
      reason: "history",
    });

    expect(commit.mock.calls[0]?.[1]).toMatchObject({
      event,
      reason: "history",
    });

    cropper.setRotation(6);
    time.frame();

    expect(change.mock.calls[1]?.[1]).toMatchObject({
      previous: first,
      reason: "imperative",
    });

    expect(commit.mock.calls[1]?.[1].previous).toBe(first);

    cropper.begin("dial");
    cropper.setRotation(9);
    time.frame();
    cropper.end();
    time.frame();
    const states: boolean[] = [];

    cropper.on("change", (_, details) => {
      states.push(details.isCanceled);
      details.cancel();
      states.push(details.isCanceled);
    });

    cropper.setRotation(3);
    time.frame();

    expect({
      dial: change.mock.calls[2]?.[1].reason,
      states,
    }).toStrictEqual({ dial: "dial", states: [false, true] });
  });
});

describe("gesture events", () => {
  it("gives gesturestart and gestureend the reason and event, and commit the last", () => {
    const { cropper, time } = setup();
    const starts = vi.fn<CropperEvents["gesturestart"]>();
    const ends = vi.fn<CropperEvents["gestureend"]>();
    const commit = vi.fn<CropperEvents["commit"]>();

    cropper.on("gesturestart", starts);
    cropper.on("gestureend", ends);
    cropper.on("commit", commit);
    const down = new Event("down");
    const up = new Event("up");

    cropper.begin("dial", down);
    cropper.setRotation(4);
    time.frame();
    cropper.end(up);
    time.frame();
    expect(starts.mock.calls).toStrictEqual([["dial", down]]);
    expect(ends.mock.calls).toStrictEqual([["dial", up]]);
    expect(commit.mock.calls[0]?.[1].event).toBe(up);
  });
});

describe("frame", () => {
  it("fires on a frame that moved, and invalidate asks for one more", () => {
    const { cropper, time } = setup();
    const frame = vi.fn<CropperEvents["frame"]>();

    cropper.on("frame", frame);
    cropper.setRotation(3);
    time.frame();
    expect(frame).toHaveBeenCalledOnce();

    expect(frame.mock.calls[0]?.[0]).toMatchObject({
      state: cropper.getCropState(),
      value: cropper.getValue(),
    });

    time.frames(3);
    expect(frame).toHaveBeenCalledOnce();
    cropper.invalidate();
    time.frame();
    expect(frame).toHaveBeenCalledTimes(2);
  });
});

describe("settle", () => {
  it("fires each time the last animation stops, and never for a plain write", () => {
    const { cropper, time } = setup();
    const settle = vi.fn<() => void>();

    cropper.on("settle", settle);
    cropper.setRotation(3);
    time.frames(3);
    expect(settle).not.toHaveBeenCalled();
    let left = 2;

    cropper.run(() => {
      left -= 1;

      return left > 0;
    });

    expect(cropper.getState().settling).toBeTruthy();
    time.frame();
    expect(settle).not.toHaveBeenCalled();
    time.frame();

    expect([
      settle.mock.calls.length,
      cropper.getState().settling,
    ]).toStrictEqual([1, false]);

    cropper.run(() => false);
    time.frames(2);
    expect(settle).toHaveBeenCalledTimes(2);
  });
});

describe("stop", () => {
  it("ends the gesture, drops motion, commits and keeps working", () => {
    const { change, commit, cropper, time } = setup();
    const stop = vi.fn<() => void>();
    const ends = vi.fn<CropperEvents["gestureend"]>();
    const task = vi.fn<() => boolean>(() => true);

    cropper.on("stop", stop);
    cropper.on("gestureend", ends);
    cropper.begin("pan");
    cropper.setRotation(3);
    cropper.run(task);
    cropper.stop();

    expect({
      change: change.mock.calls.length,
      commit: commit.mock.calls.length,
      ends: ends.mock.calls.length,
      interacting: cropper.getState().interacting,
      pending: time.pending(),
      settling: cropper.getState().settling,
      stop: stop.mock.calls.length,
    }).toStrictEqual({
      change: 1,
      commit: 1,
      ends: 1,
      interacting: null,
      pending: 0,
      settling: false,
      stop: 1,
    });

    time.frames(2);
    expect(task).not.toHaveBeenCalled();
    cropper.setRotation(6);
    time.frame();
    expect(commit).toHaveBeenCalledTimes(2);
  });
});

describe("destroy", () => {
  it("emits once, runs plugins once, drops listeners and tasks, and ignores later writes", () => {
    const destroyPlugin = vi.fn<() => void>();
    const { cropper, time } = setup({
      plugins: [{ destroy: destroyPlugin, init: () => {}, name: "p" }],
    });
    const destroyed = vi.fn<() => void>();
    const stop = vi.fn<() => void>();
    const subscriber = vi.fn<() => void>();

    cropper.on("destroy", destroyed);
    cropper.on("stop", stop);
    cropper.subscribe(subscriber);
    cropper.run(() => true);
    subscriber.mockClear();
    const before = cropper.getValue();

    cropper.destroy();
    cropper.destroy();
    cropper.setValue({ rotation: 5 });
    cropper.setRotation(5);
    cropper.setZoom(3);
    cropper.panBy(0.1, 0);
    cropper.rotate90();
    cropper.flip();
    cropper.reset();
    cropper.setAspect(1);
    cropper.setImage({ height: 10, width: 10 });
    cropper.setOptions({ disabled: true });
    expect(cropper.getValue()).toBe(before);
    cropper.stop();

    expect({
      begin: cropper.begin("pan"),
      destroyed: destroyed.mock.calls.length,
      pending: time.pending(),
      plugin: destroyPlugin.mock.calls.length,
      settling: cropper.getState().settling,
      stop: stop.mock.calls.length,
      subscriber: subscriber.mock.calls.length,
    }).toStrictEqual({
      begin: false,
      destroyed: 1,
      pending: 0,
      plugin: 1,
      settling: false,
      stop: 0,
      subscriber: 0,
    });
  });
});

describe("removing a listener", () => {
  it("stops on() and subscribe() listeners", () => {
    const { cropper, time } = setup();
    const change = vi.fn<CropperEvents["change"]>();
    const subscriber = vi.fn<() => void>();
    const off = cropper.on("change", change);
    const unsubscribe = cropper.subscribe(subscriber);

    off();
    unsubscribe();
    cropper.setRotation(3);
    time.frame();
    expect(change).not.toHaveBeenCalled();
    expect(subscriber).not.toHaveBeenCalled();
  });
});

describe("Area keys", () => {
  it.each([
    ["ArrowRight", false, 0.01, 0, 1],
    ["ArrowLeft", false, -0.01, 0, 1],
    ["ArrowDown", false, 0, 0.01, 1],
    ["ArrowUp", false, 0, -0.01, 1],
    ["ArrowRight", true, 0.1, 0, 1],
    ["ArrowUp", true, 0, -0.1, 1],
    ["+", false, 0, 0, 1.1],
    ["=", false, 0, 0, 1.1],
    ["-", false, 0, 0, 1 / 1.1],
    ["_", false, 0, 0, 1 / 1.1],
  ] as const)(
    "%s with shift %s moves by a share of the crop and zooms by a factor",
    (name, shiftKey, x, y, factor) => {
      const { cropper } = setup();

      cropper.setZoom(4);
      const { center, size } = cropper.getValue();

      pressArea(cropper, name, shiftKey);

      expect(cropper.getValue().center.x).toBeCloseTo(
        center.x + x * size.width,
        9
      );

      expect(cropper.getValue().center.y).toBeCloseTo(
        center.y + y * size.height,
        9
      );

      expect(cropper.getZoom()).toBeCloseTo(4 * factor, 6);
    }
  );

  it("commits one burst once, as keyboard", () => {
    const { commit, cropper, time } = setup();

    cropper.setZoom(4, { emit: false });
    const handlers = areaKeyHandlers(cropper);
    const down = key({ key: "ArrowRight" });

    handlers.onKeyDown(down);
    handlers.onKeyDown(down);
    time.frame();
    handlers.onKeyUp(down);
    time.frame();
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[1].reason).toBe("keyboard");
  });
});

describe("export plan", () => {
  it("holds a locked aspect on a turned photo", () => {
    for (const quarterTurns of [0, 1, 2, 3] as const) {
      const { cropper } = setup({
        defaultValue: { aspect: 1.7, quarterTurns },
        image: { height: 2999, width: 4001 },
      });
      const plan = cropper.getPixelCrop();

      expect(
        Math.abs((plan?.width ?? 0) - 1.7 * (plan?.height ?? 0))
      ).toBeLessThanOrEqual(1.7);
    }
  });
});

const recentring = () => {
  vi.useFakeTimers();
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 1000, width: 1000 },
  });
  const view = viewOf(cropper);

  view.setOptions({ recenterDelay: 10 });

  view.setLayout({
    dpr: 1,
    height: 400,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 400,
  });

  time.frame();

  return { cropper, time, view };
};

const shrink = ({ cropper, view }: ReturnType<typeof recentring>): void => {
  const owner = {};

  cropper.begin("resize", undefined, owner);
  view.hold();
  const state = stateOf(cropper);

  cropper.setCropState(
    {
      ...state,
      crop: { height: 400, width: 400, x: -200, y: 200 },
    },
    { keep: "size", reason: "resize" }
  );

  view.release();
  cropper.end(undefined, owner);
};

describe("recentre in the view", () => {
  it("keeps the same photo pixels under the rect while the rect moves to centre", () => {
    const fixture = recentring();
    const { cropper, time, view } = fixture;

    shrink(fixture);
    time.frame();
    const value = cropper.getValue();
    const first = view.frame();

    expect((first?.rect.x ?? 0) + (first?.rect.width ?? 0) / 2).toBeLessThan(
      190
    );

    vi.advanceTimersByTime(10);
    const under: { x: number; y: number }[] = [];
    const off = view.onFrame((frame) => {
      under.push(
        applyHomography(invertMatrix3(frame.matrix), {
          x: frame.rect.x + frame.rect.width / 2,
          y: frame.rect.y + frame.rect.height / 2,
        })
      );
    });

    time.frames(120);
    off();
    const end = view.frame();

    expect(under.length).toBeGreaterThan(10);
    expect((end?.rect.x ?? 0) + (end?.rect.width ?? 0) / 2).toBeCloseTo(200, 0);

    for (const point of under) {
      expect(Math.abs(point.x - (under[0]?.x ?? 0))).toBeLessThan(5);
      expect(Math.abs(point.y - (under[0]?.y ?? 0))).toBeLessThan(5);
    }

    expect(cropper.getValue()).toBe(value);
    view.destroy();
    vi.useRealTimers();
  });

  it("waits as long as recenterDelay asks, and a new touch cancels the wait", () => {
    const fixture = recentring();
    const { cropper, time, view } = fixture;

    view.setOptions({ recenterDelay: 1060 });
    shrink(fixture);
    time.frame();
    vi.advanceTimersByTime(1059);
    time.frame();
    expect(view.chrome().transition).toBeNull();
    vi.advanceTimersByTime(1);
    time.frame();
    expect(view.chrome().transition).toBe("recenter");
    time.frames(120);
    expect(view.chrome().transition).toBeNull();

    shrink(fixture);
    time.frame();
    vi.advanceTimersByTime(250);
    cropper.begin("pan");
    vi.advanceTimersByTime(1200);
    time.frame();
    expect(view.chrome().transition).toBeNull();
    expect(cropper.getState().interacting).toBe("pan");
    cropper.end();
    view.destroy();
    vi.useRealTimers();
  });
});

describe("a value that misses its aspect", () => {
  it("is reshaped at the same area", () => {
    const { cropper } = setup({ defaultValue: { aspect: 1 } });

    cropper.setValue({ size: { height: 0.1, width: 0.4 } });
    const { crop } = stateOf(cropper);
    const side = Math.sqrt(0.4 * PHOTO.width * 0.1 * PHOTO.height);

    expect(crop.width).toBeCloseTo(side, 6);
    expect(crop.height).toBeCloseTo(side, 6);
  });
});

const tooBig = (cropper: Cropper) => ({
  ...stateOf(cropper),
  angle: 20,
  crop: { height: 1800, width: 2400, x: -800, y: 300 },
});

describe("setCropState", () => {
  it("holds the centre with keep centre and the size by default", () => {
    const centre = setup().cropper;

    centre.setCropState(tooBig(centre), { keep: "center" });
    expect(stateOf(centre).crop.x).toBeCloseTo(-800, 6);
    expect(stateOf(centre).crop.width).toBeLessThan(2400);
    const size = setup().cropper;

    size.setCropState(tooBig(size));
    expect(stateOf(size).crop.width).toBeCloseTo(2400, 6);
    expect(stateOf(size).crop.x).not.toBeCloseTo(-800, 6);
  });

  it("drops a state from the photo before", () => {
    const { cropper } = setup();
    const old = stateOf(cropper);

    cropper.setImage({ height: 900, width: 300 });
    const fresh = cropper.getCropState();

    cropper.setCropState(old);
    expect(cropper.getCropState()).toBe(fresh);
  });
});

describe("the first photo", () => {
  it("publishes one frame and no change", () => {
    const time = fakeClock();
    const change = vi.fn<CropperEvents["change"]>();
    const frame = vi.fn<CropperEvents["frame"]>();
    const cropper = createCropper({ clock: time.clock, onValueChange: change });

    cropper.on("frame", frame);
    cropper.setImage(PHOTO);
    time.frames(2);
    expect(frame).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
  });
});

describe("the public entries", () => {
  it("publish exactly these names and no geometry entry", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    );

    expect(manifest).not.toHaveProperty(["exports", "./geometry"]);

    expect(Object.keys(core).toSorted()).toMatchInlineSnapshot(`
      [
        "aspectRatio",
        "changedFields",
        "coverScale",
        "covers",
        "createCropper",
        "decay",
        "defaultValue",
        "frameClock",
        "parse",
        "sameAspect",
        "serialize",
        "stateToValue",
        "toSharp",
        "valueToState",
        "valuesEqual",
        "velocityTracker",
      ]
    `);

    expect(Object.keys(dom).toSorted()).toMatchInlineSnapshot(`
      [
        "DIAL_TICKS",
        "ZrizError",
        "areaKeyHandlers",
        "attachImage",
        "bindArea",
        "bindDial",
        "bindDialTicks",
        "bindDialValue",
        "bindHandle",
        "bindImage",
        "bindMask",
        "bindPhoto",
        "bindState",
        "bindViewport",
        "bindZoomThumb",
        "cssMatrix",
        "dialAria",
        "dialHandlers",
        "dialState",
        "discardImage",
        "exportCrop",
        "exportImage",
        "fitPlacement",
        "handleHandlers",
        "imageMatrix",
        "imageOf",
        "loadImage",
        "orientationOf",
        "setCropShape",
        "sniff",
        "stateAttributes",
        "tickData",
        "viewOf",
        "viewportController",
        "zoomAria",
        "zoomHandlers",
      ]
    `);
  });
});
