import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  aspectRatio,
  changedFields,
  createCropper,
  defaultValue,
  frameClock,
  parse,
} from "../src";
import type { Clock, Cropper, CropperEvents, CropperOptions } from "../src";
import { areaKeyHandlers } from "../src/dom/controls";
import { fitPlacement, viewOf } from "../src/dom/view";
import * as geometry from "../src/geometry";
import {
  applyHomography,
  dragHandle,
  exportPlan,
  imagePlanes,
  invertMatrix3,
  isCropCovered,
  sourceToWorking,
  workingToSource,
} from "../src/geometry";
import { fakeClock } from "./fake-clock";

const PHOTO = { height: 3000, width: 4000 };

const setup = (options: CropperOptions = {}) => {
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: PHOTO,
    ...options,
  });

  return { cropper, time };
};

const stateOf = (cropper: Cropper) => {
  const state = cropper.getCropState();

  if (!state) {
    throw new Error("no image");
  }

  return state;
};

describe("the geometry entry", () => {
  it("keeps the shallow field compare to itself", () => {
    expect(Object.keys(geometry)).not.toContain("sameFields");
  });
});

describe("panBy", () => {
  it("moves by fractions of the photo's width and height", () => {
    const { cropper } = setup();

    cropper.setZoom(4);
    const { x, y } = cropper.getValue().center;

    cropper.panBy(0.1, 0.05);
    expect(cropper.getValue().center.x).toBeCloseTo(x + 0.1, 9);
    expect(cropper.getValue().center.y).toBeCloseTo(y + 0.05, 9);
  });

  it("reads the fractions off the turned photo", () => {
    const { cropper } = setup();

    cropper.rotate90();
    cropper.setZoom(4);
    const before = stateOf(cropper).crop;

    cropper.panBy(0.1, 0.05);
    const after = stateOf(cropper).crop;

    expect(after.x - before.x).toBeCloseTo(0.1 * PHOTO.height, 6);
    expect(after.y - before.y).toBeCloseTo(0.05 * PHOTO.width, 6);
  });
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

describe("turning an off-centre crop", () => {
  it("keeps the photo point under the centre and shrinks to stay covered", () => {
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

  it("moves a crop centred on the photo's edge and keeps its size", () => {
    const { cropper } = setup();

    cropper.setValue({
      center: { x: 1, y: 1 },
      size: { height: 0.3, width: 0.3 },
    });

    expect(cropper.getValue().center).toStrictEqual({ x: 0.85, y: 0.85 });
    expect(cropper.getValue().size).toStrictEqual({ height: 0.3, width: 0.3 });
  });

  it("keeps a crop whose centre is off the photo valid", () => {
    const { cropper } = setup();

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

  it("stays as large as the photo allows on a smaller photo", () => {
    const { cropper } = setup({
      defaultValue: { aspect: 1 },
      image: { height: 200, width: 300 },
      minSize: { height: 512, width: 512 },
    });

    expect(stateOf(cropper).crop.height).toBeCloseTo(200, 6);
    expect(cropper.getRotationLimit()).toBe(0);
  });

  it("caps the angle on a tiny photo and reports the cap", () => {
    const { cropper } = setup({
      image: { height: 100, width: 40 },
      minSize: { height: 30, width: 30 },
    });
    const limit = cropper.getRotationLimit();

    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThan(45);
    cropper.setRotation(45);
    expect(cropper.getValue().rotation).toBeCloseTo(limit, 9);
  });

  it("returns the full angle with room to spare", () => {
    const { cropper } = setup();

    expect(cropper.getRotationLimit()).toBe(45);
    cropper.setValue({ rotation: 90 });
    expect(cropper.getValue().rotation).toBe(45);
  });
});

describe("maxZoom", () => {
  it("bounds setZoom and a value that asks for more", () => {
    const { cropper } = setup({ maxZoom: 2 });

    expect(cropper.getMaxZoom()).toBe(2);
    cropper.setZoom(10);
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    cropper.setValue({ size: { height: 0.01, width: 0.01 } });
    expect(cropper.getZoom()).toBeLessThanOrEqual(2 + 1e-6);
  });

  it("defaults to 15 and can go above it", () => {
    const { cropper } = setup();

    expect(cropper.getMaxZoom()).toBe(15);
    const deep = setup({ maxZoom: 30 }).cropper;

    deep.setZoom(30);
    expect(deep.getZoom()).toBeCloseTo(30, 6);
  });
});

const isKeyEvent = (value: object): value is KeyboardEvent => "key" in value;

const keyEvent = (init: object): KeyboardEvent => {
  if (!isKeyEvent(init)) {
    throw new TypeError("no key");
  }

  return init;
};

describe("rotate90 and flip", () => {
  it("turns a numeric aspect with the photo and leaves a named one", () => {
    const { cropper } = setup({ defaultValue: { aspect: 4 / 3 } });

    cropper.rotate90();
    expect(cropper.getValue().aspect).toBeCloseTo(3 / 4, 12);
    expect(stateOf(cropper).aspect).toBeCloseTo(3 / 4, 12);
    const { crop } = stateOf(cropper);

    expect(crop.width / crop.height).toBeCloseTo(3 / 4, 9);
  });

  it("turns a numeric aspect clockwise too and leaves a named one", () => {
    const clockwise = setup({ defaultValue: { aspect: 4 / 3 } }).cropper;

    clockwise.rotate90("cw");
    expect(stateOf(clockwise).aspect).toBeCloseTo(3 / 4, 12);
    expect(clockwise.getValue().aspect).toBeCloseTo(3 / 4, 12);
    const free = setup().cropper;

    free.rotate90("cw");
    expect(free.getValue().aspect).toBe("free");
  });

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

describe("reset", () => {
  it("returns to defaultValue before a photo", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { rotation: 3 },
    });

    cropper.setValue({ rotation: 10 });
    cropper.reset();
    expect(cropper.getValue().rotation).toBe(3);
  });
});

describe("the value option", () => {
  it("sets the start in place of defaultValue, and reset goes to defaultValue", () => {
    const { cropper } = setup({
      defaultValue: { rotation: 3 },
      value: { ...defaultValue, rotation: 10 },
    });

    expect(cropper.getValue().rotation).toBe(10);
    cropper.reset();
    expect(cropper.getValue().rotation).toBe(3);
  });
});

describe("setOptions", () => {
  it("refits the crop to new limits with reason coverage", () => {
    const change = vi.fn<CropperEvents["change"]>();
    const { cropper, time } = setup({ onValueChange: change });

    cropper.setZoom(10, { emit: false });
    cropper.setOptions({ maxZoom: 2 });
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
    time.frame();
    expect(change.mock.calls[0]?.[1].reason).toBe("coverage");
  });

  it("stays pristine when the new limits move the start value", () => {
    const { cropper } = setup({
      defaultValue: { size: { height: 0.1, width: 0.1 } },
    });

    expect(cropper.getState().pristine).toBeTruthy();
    cropper.setOptions({ maxZoom: 2 });
    expect(cropper.getState().pristine).toBeTruthy();
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
    ]) {
      const { cropper } = setup();

      cropper.setImage(size);
      expect(cropper.getCropState()).toBeNull();
      expect(cropper.getState().ready).toBeFalsy();
      expect(cropper.getZoom()).toBe(1);
    }
  });
});

const logOf = () => {
  const change = vi.fn<CropperEvents["change"]>();
  const commit = vi.fn<CropperEvents["commit"]>();

  return { change, commit, onValueChange: change, onValueCommit: commit };
};

describe("change details", () => {
  it("holds what the last change left in previous", () => {
    const { change, commit, ...options } = logOf();
    const { cropper, time } = setup(options);

    cropper.setRotation(3);
    time.frame();
    const first = cropper.getValue();

    cropper.setRotation(6);
    time.frame();
    expect(change.mock.calls[1]?.[1].previous).toBe(first);
    expect(commit.mock.calls[1]?.[1].previous).toBe(first);
  });

  it("passes the event and reason of a write to change and commit", () => {
    const { change, commit, ...options } = logOf();
    const { cropper, time } = setup(options);
    const event = new Event("x");

    cropper.setRotation(3, { event, reason: "history" });
    time.frame();
    expect(change.mock.calls[0]?.[1].event).toBe(event);
    expect(change.mock.calls[0]?.[1].phase).toBe("instant");
    expect(change.mock.calls[0]?.[1].reason).toBe("history");
    expect(commit.mock.calls[0]?.[1].event).toBe(event);
    expect(commit.mock.calls[0]?.[1].reason).toBe("history");
  });

  it("names the write itself outside a gesture and the gesture inside one", () => {
    const { change, ...options } = logOf();
    const { cropper, time } = setup(options);

    cropper.setRotation(3);
    time.frame();
    expect(change.mock.calls[0]?.[1].reason).toBe("imperative");
    cropper.begin("dial");
    cropper.setRotation(6);
    time.frame();
    cropper.end();
    time.frame();
    expect(change.mock.calls[1]?.[1].reason).toBe("dial");
  });

  it("reports isCanceled once cancel ran", () => {
    const { cropper, time } = setup();
    const states: boolean[] = [];

    cropper.on("change", (_, details) => {
      states.push(details.isCanceled);
      details.cancel();
      states.push(details.isCanceled);
    });

    cropper.setRotation(3);
    time.frame();
    expect(states).toStrictEqual([false, true]);
  });

  it("puts the export plan on commit", () => {
    const { commit, ...options } = logOf();
    const { cropper, time } = setup(options);

    cropper.setZoom(2);
    time.frame();
    expect(commit.mock.calls[0]?.[1].pixelCrop?.width).toBeCloseTo(2000, 0);
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
    const change = vi.fn<CropperEvents["change"]>();
    const commit = vi.fn<CropperEvents["commit"]>();
    const { cropper, time } = setup({
      onValueChange: change,
      onValueCommit: commit,
    });
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
  it("emits once, runs plugins once, and ignores every later write", () => {
    const destroyPlugin = vi.fn<() => void>();
    const { cropper, time } = setup({
      plugins: [{ destroy: destroyPlugin, init: () => {}, name: "p" }],
    });
    const destroyed = vi.fn<() => void>();

    cropper.on("destroy", destroyed);
    const before = cropper.getValue();

    cropper.destroy();
    cropper.destroy();
    expect(destroyed).toHaveBeenCalledOnce();
    expect(destroyPlugin).toHaveBeenCalledOnce();
    cropper.setValue({ rotation: 5 });
    cropper.setRotation(5);
    cropper.setZoom(3);
    cropper.panBy(0.1, 0);
    cropper.rotate90();
    cropper.flip();
    cropper.reset();
    cropper.setAspect(1);
    cropper.setImage({ height: 10, width: 10 });
    expect(cropper.getValue()).toBe(before);
    expect(cropper.begin("pan")).toBeFalsy();
    expect(time.pending()).toBe(0);
  });

  it("drops every listener and task", () => {
    const { cropper } = setup();
    const stop = vi.fn<() => void>();
    const subscriber = vi.fn<() => void>();

    cropper.on("stop", stop);
    cropper.subscribe(subscriber);
    cropper.run(() => true);
    subscriber.mockClear();
    cropper.destroy();
    cropper.setOptions({ disabled: true });
    expect(cropper.getState().settling).toBeFalsy();
    cropper.stop();
    expect(stop).not.toHaveBeenCalled();
    expect(subscriber).not.toHaveBeenCalled();
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

const areaKey = (init: Partial<KeyboardEvent>): KeyboardEvent =>
  keyEvent({
    altKey: false,
    preventDefault: () => {},
    shiftKey: false,
    ...init,
  });

const pressArea = (cropper: Cropper, init: Partial<KeyboardEvent>): void => {
  const handlers = areaKeyHandlers(cropper);

  handlers.onKeyDown(areaKey(init));
  handlers.onKeyUp(areaKey(init));
};

describe("Area keys", () => {
  it.each([
    ["ArrowRight", 1, 0],
    ["ArrowLeft", -1, 0],
    ["ArrowDown", 0, 1],
    ["ArrowUp", 0, -1],
  ] as const)(
    "%s moves the crop by 1%% of its size, 10%% with shift",
    (name, x, y) => {
      for (const [shiftKey, step] of [
        [false, 0.01],
        [true, 0.1],
      ] as const) {
        const { cropper } = setup();

        cropper.setValue({ size: { height: 0.4, width: 0.2 } });
        const { center, size } = cropper.getValue();

        pressArea(cropper, { key: name, shiftKey });

        expect(cropper.getValue().center.x).toBeCloseTo(
          center.x + x * step * size.width,
          9
        );

        expect(cropper.getValue().center.y).toBeCloseTo(
          center.y + y * step * size.height,
          9
        );
      }
    }
  );

  it("commits one burst once, as keyboard", () => {
    const commit = vi.fn<CropperEvents["commit"]>();
    const { cropper, time } = setup({ onValueCommit: commit });

    cropper.setZoom(4, { emit: false });
    const handlers = areaKeyHandlers(cropper);
    const down = areaKey({ key: "ArrowRight" });

    handlers.onKeyDown(down);
    handlers.onKeyDown(down);
    time.frame();
    handlers.onKeyUp(down);
    time.frame();
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[1].reason).toBe("keyboard");
  });
});

describe("writes keep the centre", () => {
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
  });

  it("reset returns to the size of defaultValue at its own aspect", () => {
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
  });
});

describe("cancel, run and owners", () => {
  it("cancels a run with its cancel function", () => {
    const { cropper, time } = setup();
    const task = vi.fn<() => boolean>(() => true);
    const stop = cropper.run(task);

    stop();
    time.frames(2);
    expect(task).not.toHaveBeenCalled();
    expect(cropper.getState().settling).toBeFalsy();
  });

  it("lets only the owner cancel a gesture", () => {
    const { cropper } = setup();
    const owner = {};
    const start = cropper.getValue().rotation;

    cropper.begin("dial", undefined, owner);
    cropper.setRotation(9);
    cropper.cancel(undefined, {});
    expect(cropper.getState().interacting).toBe("dial");
    expect(cropper.getValue().rotation).toBe(9);
    cropper.cancel(undefined, owner);
    expect(cropper.getState().interacting).toBeNull();
    expect(cropper.getValue().rotation).toBe(start);
  });

  it("restores the crop state with the value when a listener cancels", () => {
    const { cropper, time } = setup();
    const before = cropper.getCropState();

    cropper.on("change", (_, details) => {
      details.cancel();
    });

    cropper.setRotation(10);
    time.frame();
    expect(cropper.getCropState()).toBe(before);
  });

  it("commits a refit from setImage as coverage", () => {
    const commit = vi.fn<CropperEvents["commit"]>();
    const { cropper, time } = setup({
      minSize: { height: 200, width: 200 },
      onValueCommit: commit,
    });

    cropper.setZoom(4, { emit: false });
    cropper.setImage({ height: 400, width: 400 });
    time.frame();
    expect(commit.mock.calls[0]?.[1].reason).toBe("coverage");
  });
});

describe("value helpers", () => {
  it("clamps horizontal perspective and reads mirrored strictly", () => {
    expect(
      parse({ perspective: { horizontal: -90 } })?.perspective.horizontal
    ).toBe(-30);

    expect(parse({ mirrored: 1 })?.mirrored).toBeFalsy();
    expect(parse({ mirrored: "true" })?.mirrored).toBeFalsy();
  });

  it("lists a horizontal perspective change", () => {
    expect(
      changedFields(defaultValue, {
        ...defaultValue,
        perspective: { horizontal: 5, vertical: 0 },
      })
    ).toStrictEqual(["perspective"]);
  });

  it("reads the original aspect off the turned photo", () => {
    expect(aspectRatio("original", PHOTO, 1)).toBeCloseTo(3 / 4, 12);
    expect(aspectRatio("original", PHOTO, 2)).toBeCloseTo(4 / 3, 12);
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

  it("keeps the pixel rect inside the photo when the crop touches its corner", () => {
    const { cropper } = setup();

    cropper.setValue({
      center: { x: 0, y: 0 },
      size: { height: 0.2, width: 0.2 },
    });

    const rect = exportPlan({
      ...stateOf(cropper),
      crop: { height: 100, width: 100, x: -2500, y: -2000 },
    }).pixelRect;

    expect(rect?.left).toBe(0);
    expect(rect?.top).toBe(0);
  });
});

describe("the published frame", () => {
  it("snaps the rect behind the mask inward to device pixels", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 777, width: 1001 },
    });
    const layout = {
      dpr: 3,
      height: 500.3,
      inset: { bottom: 11.1, left: 13.7, right: 7.2, top: 9.9 },
      width: 333.3,
    };
    const view = viewOf(cropper);

    view.setLayout(layout);
    const { crop } = stateOf(cropper);
    const { offset, scale } = fitPlacement(layout, stateOf(cropper));
    const rect = view.frame()?.rect;

    if (!rect) {
      throw new Error("no frame");
    }

    const x0 = offset.x + scale * (crop.x - crop.width / 2);
    const y0 = offset.y + scale * (crop.y - crop.height / 2);

    for (const edge of [
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
    ]) {
      expect(Math.abs(edge * 3 - Math.round(edge * 3))).toBeLessThan(1e-9);
    }

    expect(rect.x).toBeGreaterThanOrEqual(x0 - 1e-6);
    expect(rect.y).toBeGreaterThanOrEqual(y0 - 1e-6);

    expect(rect.x + rect.width).toBeLessThanOrEqual(
      x0 + scale * crop.width + 1e-6
    );

    expect(rect.y + rect.height).toBeLessThanOrEqual(
      y0 + scale * crop.height + 1e-6
    );

    view.destroy();
  });
});

describe("dragHandle with an empty aspect range", () => {
  it("stops at the photo edge when the crop started under the minimum", () => {
    const { cropper } = setup({ image: { height: 100, width: 100 } });

    cropper.setValue({
      center: { x: 0.9, y: 0.9 },
      size: { height: 0.1, width: 0.1 },
    });

    const state = stateOf(cropper);
    const { crop } = state;
    const start = {
      x0: crop.x - crop.width / 2,
      x1: crop.x + crop.width / 2,
      y0: crop.y - crop.height / 2,
      y1: crop.y + crop.height / 2,
    };
    const rect = dragHandle(
      start,
      "se",
      { x: 500, y: 500 },
      { aspect: 1, minHeight: 50, minWidth: 50, planes: imagePlanes(state) }
    );

    expect(rect.y1 - rect.y0).toBeCloseTo(15, 9);
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

  it("never changes the value over a thousand recentres and layouts", () => {
    const fixture = recentring();
    const { cropper, time, view } = fixture;

    shrink(fixture);
    time.frame();
    const value = cropper.getValue();

    for (let i = 0; i < 1000; i += 1) {
      view.setLayout({
        dpr: 2,
        height: 700 - (i % 5),
        inset: { bottom: 0, left: 0, right: 0, top: 0 },
        width: 900 + (i % 7),
      });

      time.frame();
      cropper.begin("pan");
      view.hold();
      view.release();
      cropper.end();
      vi.advanceTimersByTime(10);
      time.frames(3);
    }

    expect(cropper.getValue()).toBe(value);
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

const pressAreaKey = (cropper: Cropper, name: string): void => {
  const handlers = areaKeyHandlers(cropper);
  const event = keyEvent({
    altKey: false,
    key: name,
    preventDefault: () => {},
    shiftKey: false,
  });

  handlers.onKeyDown(event);
  handlers.onKeyUp(event);
};

describe("Area zoom and reset keys", () => {
  it.each([
    ["+", 1.1],
    ["=", 1.1],
    ["-", 1 / 1.1],
    ["_", 1 / 1.1],
  ] as const)("%s zooms by 1.1", (name, factor) => {
    const { cropper } = setup();

    cropper.setZoom(4);
    pressAreaKey(cropper, name);
    expect(cropper.getZoom()).toBeCloseTo(4 * factor, 6);
  });

  it("0 goes back to where reset goes", () => {
    const { cropper } = setup({ defaultValue: { rotation: 3 } });
    const start = cropper.getValue();

    cropper.setZoom(4);
    pressAreaKey(cropper, "0");
    expect(cropper.getValue()).toStrictEqual(start);
  });

  it("alt and arrows resize, right and down grow, and a locked aspect holds", () => {
    const free = setup().cropper;

    free.setValue({ size: { height: 0.4, width: 0.4 } });
    const before = stateOf(free).crop;
    const handlers = areaKeyHandlers(free);
    const event = keyEvent({
      altKey: true,
      key: "ArrowRight",
      preventDefault: () => {},
      shiftKey: false,
    });

    handlers.onKeyDown(event);
    handlers.onKeyUp(event);
    expect(stateOf(free).crop.width).toBeCloseTo(before.width * 1.01, 6);
    expect(stateOf(free).crop.height).toBeCloseTo(before.height, 6);
    const locked = setup({ defaultValue: { aspect: 1 } }).cropper;

    locked.setValue({ size: { height: 0.4, width: 0.3 } });
    const square = stateOf(locked).crop;
    const lockedKeys = areaKeyHandlers(locked);

    lockedKeys.onKeyDown(event);
    lockedKeys.onKeyUp(event);
    expect(stateOf(locked).crop.width).toBeCloseTo(square.width * 1.01, 6);
    expect(stateOf(locked).crop.height).toBeCloseTo(square.height * 1.01, 6);
  });
});

describe("the public entries", () => {
  it("gives a clock only request and cancel", () => {
    expectTypeOf<keyof Clock>().toEqualTypeOf<"cancel" | "request">();

    expect(Object.keys(frameClock()).toSorted()).toStrictEqual([
      "cancel",
      "request",
    ]);
  });
});
