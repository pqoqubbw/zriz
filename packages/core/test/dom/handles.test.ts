import {
  assert,
  array,
  constantFrom,
  double,
  integer,
  property,
  tuple,
} from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cropper } from "../../src";
import { handleHandlers } from "../../src/dom/parts";
import type { HandleEdge } from "../../src/dom/parts";
import { fitPlacement, viewOf } from "../../src/dom/view";
import type { Layout, Placement } from "../../src/dom/view";
import { cropCorners, imagePlanes, insidePlanes } from "../../src/geometry";
import type { Point, Rect } from "../../src/geometry";
import { pointer as fakePointer, setup, stateOf } from "../cropper-fixture";
import type { Rig } from "../cropper-fixture";

const CORNER_INSET = 35;

const HANDLES: readonly (readonly [HandleEdge, number])[] = [
  ["top-left", CORNER_INSET],
  ["top", 30],
  ["top-right", CORNER_INSET],
  ["right", 40],
  ["bottom-right", CORNER_INSET],
  ["bottom", 30],
  ["bottom-left", CORNER_INSET],
  ["left", 40],
];

const EDGES = HANDLES.map(([edge]) => edge);

const LOCKS = EDGES.flatMap((edge) =>
  [null, 1].map((aspect) => ({ aspect, edge }))
);

const PRESSES = LOCKS.filter(
  ({ edge }) => edge === "top-left" || edge === "top"
);

const PADDING = 20;

const LAYOUT: Layout = {
  dpr: 1,
  height: 300,
  inset: { bottom: PADDING, left: PADDING, right: PADDING, top: PADDING },
  width: 400,
};

const TOLERANCE = 1e-6;

const pointer = (
  { x, y }: Point,
  init: { button?: number; pointerId?: number; timeStamp?: number } = {}
): PointerEvent => {
  const extra = { clientY: y, currentTarget: null, ...init };

  return fakePointer(x, 0, extra);
};

const create = (aspect: number | null = null, zoom = 1): Cropper => {
  const { cropper } = setup();

  if (aspect !== null) {
    cropper.setAspect(aspect);
  }

  if (zoom !== 1) {
    cropper.setZoom(zoom);
  }

  viewOf(cropper).setLayout(LAYOUT);

  return cropper;
};

const placementOf = (cropper: Cropper): Placement =>
  fitPlacement(LAYOUT, stateOf(cropper));

const cropOf = (cropper: Cropper): Rect => {
  const { x, y, width, height } = stateOf(cropper).crop;

  return {
    x0: x - width / 2,
    x1: x + width / 2,
    y0: y - height / 2,
    y1: y + height / 2,
  };
};

const drift = (a: Rect, b: Rect): number =>
  Math.max(
    Math.abs(a.x0 - b.x0),
    Math.abs(a.x1 - b.x1),
    Math.abs(a.y0 - b.y0),
    Math.abs(a.y1 - b.y1)
  );

const onEnd = (low: number, high: number, onLow: boolean, onHigh: boolean) => {
  if (onLow) {
    return low;
  }

  return onHigh ? high : (low + high) / 2;
};

const handleAt = (cropper: Cropper, edge: HandleEdge): Point => {
  const rect = cropOf(cropper);
  const { offset, scale } = placementOf(cropper);

  return {
    x:
      offset.x +
      scale *
        onEnd(rect.x0, rect.x1, edge.endsWith("left"), edge.endsWith("right")),
    y:
      offset.y +
      scale *
        onEnd(
          rect.y0,
          rect.y1,
          edge.startsWith("top"),
          edge.startsWith("bottom")
        ),
  };
};

const signsOf = (edge: HandleEdge): Point => ({
  x: Number(edge.endsWith("right")) - Number(edge.endsWith("left")),
  y: Number(edge.startsWith("bottom")) - Number(edge.startsWith("top")),
});

const resized = (low: number, high: number, sign: number, side: number) => {
  if (sign < 0) {
    return [high - side, high] as const;
  }

  if (sign > 0) {
    return [low, low + side] as const;
  }

  const centre = (low + high) / 2;

  return [centre - side / 2, centre + side / 2] as const;
};

const press = (
  cropper: Cropper,
  edge: HandleEdge,
  at: Point,
  pointerId = 1,
  onHeld?: (held: boolean) => void
) => {
  const handlers = handleHandlers(cropper, edge, () => null, onHeld);

  handlers.onPointerDown(pointer(at, { pointerId }));

  return handlers;
};

const PAIRS: readonly (readonly [HandleEdge, HandleEdge])[] = [
  ["top-left", "bottom-right"],
  ["top-right", "bottom-left"],
  ["top", "bottom"],
  ["left", "right"],
  ["top-left", "bottom"],
  ["right", "bottom-left"],
];

const twoFingers = (rig: Rig, edges: readonly [HandleEdge, HandleEdge]) => {
  const { cropper } = rig;

  viewOf(cropper).setLayout(LAYOUT);
  const { scale } = placementOf(cropper);
  const before = cropOf(cropper);
  const at = edges.map((edge) => handleAt(cropper, edge));
  const held: boolean[][] = edges.map(() => []);
  const handlers = edges.map((edge, index) =>
    press(cropper, edge, at[index] ?? { x: 0, y: 0 }, index + 1, (value) => {
      held[index]?.push(value);
    })
  );

  const send = (
    type: "onPointerCancel" | "onPointerMove" | "onPointerUp",
    finger: number,
    dx: number,
    dy: number,
    timeStamp?: number
  ): void => {
    const from = at[finger] ?? { x: 0, y: 0 };

    handlers[finger]?.[type](
      pointer(
        { x: from.x + dx, y: from.y + dy },
        {
          pointerId: finger + 1,
          ...(timeStamp === undefined ? {} : { timeStamp }),
        }
      )
    );
  };

  return {
    before,
    cancel: (finger: number): void => {
      send("onPointerCancel", finger, 0, 0);
    },
    held,
    lift: (finger: number, dx: number, dy: number): void => {
      send("onPointerUp", finger, dx, dy);
    },
    move: (finger: number, dx: number, dy: number, time?: number): void => {
      send("onPointerMove", finger, dx, dy, time);
    },
    scale,
  };
};

describe("handle gestures", () => {
  const listen = vi.fn<() => void>();
  const unlisten = vi.fn<() => void>();

  beforeEach(() => {
    listen.mockClear();
    unlisten.mockClear();
    vi.stubGlobal("Element", Map);
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("addEventListener", listen);
    vi.stubGlobal("removeEventListener", unlisten);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(PRESSES)(
    "$edge at aspect $aspect keeps the crop still on a press off the anchor",
    ({ edge, aspect }) => {
      const cropper = create(aspect);
      const before = cropOf(cropper);
      const at = handleAt(cropper, edge);
      const off = { x: at.x + 7, y: at.y - 5 };
      const handlers = press(cropper, edge, off);

      expect(cropper.getState().interacting).toBe("resize");
      handlers.onPointerMove(pointer(off));
      expect(drift(cropOf(cropper), before)).toBeLessThan(TOLERANCE);
      handlers.onPointerUp(pointer(off));
      expect(cropper.getState().interacting).toBeNull();
    }
  );

  it.each(HANDLES)(
    "%s keeps an aspect lock and pins the opposite side",
    (edge, inset) => {
      const cropper = create(1);
      const before = cropOf(cropper);
      const { scale } = placementOf(cropper);
      const sign = signsOf(edge);
      const at = handleAt(cropper, edge);
      const side = before.y1 - before.y0 - inset / scale;
      const handlers = press(cropper, edge, at);

      handlers.onPointerMove(
        pointer({ x: at.x - 40 * sign.x, y: at.y - 30 * sign.y })
      );

      const [x0, x1] = resized(before.x0, before.x1, sign.x, side);
      const [y0, y1] = resized(before.y0, before.y1, sign.y, side);

      expect(drift(cropOf(cropper), { x0, x1, y0, y1 })).toBeLessThan(
        TOLERANCE
      );
    }
  );

  it.each(LOCKS)(
    "$edge at aspect $aspect stops at the viewport padding",
    ({ edge, aspect }) => {
      const cropper = create(aspect, 2);
      const { offset, scale } = placementOf(cropper);
      const sign = signsOf(edge);
      const at = handleAt(cropper, edge);
      const handlers = press(cropper, edge, at);

      handlers.onPointerMove(
        pointer({ x: at.x + 22 * sign.x, y: at.y + 16 * sign.y })
      );

      const { x0, x1, y0, y1 } = cropOf(cropper);

      expect(
        Math.max(
          PADDING - (offset.x + scale * x0),
          offset.x + scale * x1 - (LAYOUT.width - PADDING),
          PADDING - (offset.y + scale * y0),
          offset.y + scale * y1 - (LAYOUT.height - PADDING)
        )
      ).toBeLessThan(TOLERANCE);
    }
  );

  it("ignores a right-button press", () => {
    const cropper = create();
    const before = cropOf(cropper);
    const starts = vi.fn<() => void>();

    cropper.on("gesturestart", starts);
    const at = handleAt(cropper, "bottom-right");
    const handlers = handleHandlers(cropper, "bottom-right", () => null);

    handlers.onPointerDown(pointer(at, { button: 2 }));
    expect(starts).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    handlers.onPointerMove(pointer({ x: at.x + 10, y: at.y + 10 }));
    expect(drift(cropOf(cropper), before)).toBeLessThan(TOLERANCE);
  });

  it("ignores a second pointer while the first keeps the drag and frees every listener", () => {
    const cropper = create();
    const before = cropOf(cropper);
    const { scale } = placementOf(cropper);
    const at = handleAt(cropper, "left");
    const handlers = press(cropper, "left", at);
    const second = { pointerId: 2 };
    const listeners = listen.mock.calls.length;

    handlers.onPointerDown(pointer({ x: at.x + 50, y: at.y }, second));
    handlers.onPointerMove(pointer({ x: at.x + 60, y: at.y }, second));
    const ignored = {
      drift: drift(cropOf(cropper), before) < TOLERANCE,
      listeners: listen.mock.calls.length - listeners,
    };

    handlers.onPointerUp(pointer({ x: at.x + 60, y: at.y }, second));
    const still = cropper.getState().interacting;

    handlers.onPointerMove(pointer({ x: at.x + 40, y: at.y }));
    expect(cropOf(cropper).x0).toBeCloseTo(before.x0 + 40 / scale, 6);
    handlers.onPointerUp(pointer({ x: at.x + 40, y: at.y }));

    expect({ ignored, still }).toStrictEqual({
      ignored: { drift: true, listeners: 0 },
      still: "resize",
    });

    expect(cropper.getState().interacting).toBeNull();
    expect(unlisten).toHaveBeenCalledTimes(listen.mock.calls.length);
  });

  it("opens and closes the gesture on a press before layout and leaves the value alone", () => {
    const { commit, cropper, time } = setup();
    const starts = vi.fn<() => void>();
    const ends = vi.fn<() => void>();
    const value = cropper.getValue();

    cropper.on("gesturestart", starts);
    cropper.on("gestureend", ends);
    const handlers = press(cropper, "top-left", { x: 10, y: 10 });

    expect({
      ends: ends.mock.calls.length,
      interacting: cropper.getState().interacting,
      listeners: listen.mock.calls.length,
      starts: starts.mock.calls.length,
    }).toStrictEqual({ ends: 1, interacting: null, listeners: 0, starts: 1 });

    handlers.onPointerMove(pointer({ x: 80, y: 80 }));
    handlers.onPointerUp(pointer({ x: 80, y: 80 }));
    time.frames(5);
    expect(cropper.getValue()).toStrictEqual(value);
    expect(commit).not.toHaveBeenCalled();
  });

  it("moves two opposite corners together in one gesture and keeps going when a finger lifts", () => {
    const rig = setup();
    const { commit, cropper, time } = rig;
    const starts = vi.fn<() => void>();
    const ends = vi.fn<() => void>();

    cropper.on("gesturestart", starts);
    cropper.on("gestureend", ends);
    const { before, lift, move, scale } = twoFingers(rig, [
      "top-left",
      "bottom-right",
    ]);

    move(0, 40, 30);
    move(1, -20, -10);
    const both = cropOf(cropper);

    expect(
      drift(both, {
        x0: before.x0 + 40 / scale,
        x1: before.x1 - 20 / scale,
        y0: before.y0 + 30 / scale,
        y1: before.y1 - 10 / scale,
      })
    ).toBeLessThan(TOLERANCE);

    lift(0, 40, 30);
    expect(cropOf(cropper)).toStrictEqual(both);
    expect(cropper.getState().interacting).toBe("resize");
    move(1, -30, -25);

    expect(
      drift(cropOf(cropper), {
        ...both,
        x1: before.x1 - 30 / scale,
        y1: before.y1 - 25 / scale,
      })
    ).toBeLessThan(TOLERANCE);

    lift(1, -30, -25);
    time.frames(120);

    expect({
      commits: commit.mock.calls.length,
      ends: ends.mock.calls.length,
      interacting: cropper.getState().interacting,
      listeners: unlisten.mock.calls.length - listen.mock.calls.length,
      starts: starts.mock.calls.length,
    }).toStrictEqual({
      commits: 1,
      ends: 1,
      interacting: null,
      listeners: 0,
      starts: 1,
    });
  });

  it("refuses a handle that shares an edge and leaves the first drag alone", () => {
    const rig = setup();
    const { cropper } = rig;
    const { before, lift, move, scale } = twoFingers(rig, [
      "top-left",
      "top-right",
    ]);
    const listeners = listen.mock.calls.length;

    move(1, -50, 40);
    lift(1, -50, 40);
    expect(drift(cropOf(cropper), before)).toBeLessThan(TOLERANCE);
    move(0, 40, 30);

    expect(
      drift(cropOf(cropper), {
        ...before,
        x0: before.x0 + 40 / scale,
        y0: before.y0 + 30 / scale,
      })
    ).toBeLessThan(TOLERANCE);

    expect(cropper.getState().interacting).toBe("resize");
    lift(0, 40, 30);
    expect(listen).toHaveBeenCalledTimes(listeners);
    expect(unlisten).toHaveBeenCalledTimes(listeners);
  });

  it("restores the crop from before both fingers on Escape", () => {
    const rig = setup();
    const { cropper } = rig;
    const { before, lift, move } = twoFingers(rig, ["top", "bottom"]);

    move(0, 0, 30);
    move(1, 0, -40);
    lift(0, 0, 30);
    move(1, 0, -50);
    expect(drift(cropOf(cropper), before)).toBeGreaterThan(1);

    for (const [type, onKey] of listen.mock.calls as unknown[][]) {
      if (type === "keydown" && typeof onKey === "function") {
        Reflect.apply(onKey, undefined, [
          {
            key: "Escape",
            preventDefault: () => {},
            stopPropagation: () => {},
          },
        ]);
      }
    }

    expect(drift(cropOf(cropper), before)).toBeLessThan(TOLERANCE);
    expect(cropper.getState().interacting).toBeNull();
    move(1, 0, -80);
    expect(drift(cropOf(cropper), before)).toBeLessThan(TOLERANCE);
    expect(unlisten).toHaveBeenCalledTimes(listen.mock.calls.length);
  });

  it("resizes a locked crop from the corner under the finger that stays still", () => {
    const rig = setup();
    const { cropper } = rig;

    cropper.setAspect(1);
    const { before, move, scale } = twoFingers(rig, [
      "top-left",
      "bottom-right",
    ]);

    move(1, -40, 0);
    move(1, -40, 10);

    expect(
      drift(cropOf(cropper), {
        ...before,
        x1: before.x1 - 15 / scale,
        y1: before.y1 - 15 / scale,
      })
    ).toBeLessThan(TOLERANCE);
  });

  it("moves a locked crop with two fingers that travel together", () => {
    const rig = setup();
    const { cropper } = rig;

    cropper.setAspect(1);
    const { before, move, scale } = twoFingers(rig, [
      "top-left",
      "bottom-right",
    ]);

    move(0, 30, 30, 0);
    move(1, -30, -30, 0);
    move(0, 40, 30, 100);
    move(1, -20, -30, 100);

    expect(
      drift(cropOf(cropper), {
        x0: before.x0 + 40 / scale,
        x1: before.x1 - 20 / scale,
        y0: before.y0 + 30 / scale,
        y1: before.y1 - 30 / scale,
      })
    ).toBeLessThan(TOLERANCE);
  });

  it("refuses a held pointer id on another handle and still releases the first", () => {
    const cropper = create();
    const held: boolean[] = [];
    const at = handleAt(cropper, "top-left");
    const far = handleAt(cropper, "bottom-right");
    const first = press(cropper, "top-left", at, 1, (value) => {
      held.push(value);
    });
    const listeners = listen.mock.calls.length;
    const second = press(cropper, "bottom-right", far, 1);

    second.onPointerUp(pointer(far));
    expect(listen).toHaveBeenCalledTimes(listeners);
    expect(cropper.getState().interacting).toBe("resize");
    first.onPointerUp(pointer(at));
    expect(held).toStrictEqual([true, false]);
    expect(cropper.getState().interacting).toBeNull();
    press(cropper, "bottom-right", far, 2);
    expect(cropper.getState().interacting).toBe("resize");
  });

  it("releases the second finger when the aspect locks mid-session and keeps the first resizing", () => {
    const rig = setup();
    const { cropper } = rig;
    const { held, move } = twoFingers(rig, ["top", "bottom"]);

    move(0, 0, 20);
    move(1, 0, -20);
    cropper.setAspect(1);
    move(1, 0, -60);
    expect(held).toStrictEqual([[true], [true, false]]);
    const locked = cropOf(cropper);

    move(1, 0, -90);
    expect(cropOf(cropper)).toStrictEqual(locked);
    move(0, 0, 60);
    expect(cropOf(cropper).y0).toBeGreaterThan(locked.y0 + TOLERANCE);
    expect(cropper.getState().interacting).toBe("resize");
  });

  it("keeps a finger dragged past a limit attached when a second finger joins", () => {
    const { cropper, time } = setup();

    cropper.setZoom(2);
    time.frames(60);
    viewOf(cropper).setLayout(LAYOUT);
    const before = cropOf(cropper);
    const joined = vi.fn<(held: boolean) => void>();
    const first = press(cropper, "top-left", handleAt(cropper, "top-left"));

    first.onPointerMove(pointer({ x: -500, y: -500 }));
    const clamped = cropOf(cropper);

    press(
      cropper,
      "bottom-right",
      handleAt(cropper, "bottom-right"),
      2,
      joined
    );

    first.onPointerMove(pointer({ x: -499, y: -499 }));
    expect(drift(clamped, before)).toBeGreaterThan(1);
    expect(joined).toHaveBeenCalledWith(true);
    expect(cropOf(cropper)).toStrictEqual(clamped);
  });

  it("keeps the other finger resizing after a pointercancel and ends the gesture once", () => {
    const rig = setup();
    const { cropper } = rig;
    const ends = vi.fn<() => void>();

    cropper.on("gestureend", ends);
    const { before, cancel, held, lift, move, scale } = twoFingers(rig, [
      "top-left",
      "bottom-right",
    ]);

    cancel(0);
    move(0, 40, 30);
    move(1, -20, -10);

    expect(
      drift(cropOf(cropper), {
        ...before,
        x1: before.x1 - 20 / scale,
        y1: before.y1 - 10 / scale,
      })
    ).toBeLessThan(TOLERANCE);

    expect(ends).not.toHaveBeenCalled();
    lift(1, -20, -10);
    expect(ends).toHaveBeenCalledOnce();

    expect(held).toStrictEqual([
      [true, false],
      [true, false],
    ]);
  });

  it("keeps a rotated photo under the crop while two handles move and stays still when one lifts", () => {
    assert(
      property(
        double({ max: 45, min: -45, noNaN: true }),
        constantFrom(...PAIRS),
        constantFrom(null, 1.5),
        array(
          tuple(
            integer({ max: 1, min: 0 }),
            integer({ max: 3, min: 0 }),
            double({ max: 300, min: -300, noNaN: true }),
            double({ max: 300, min: -300, noNaN: true })
          ),
          { maxLength: 12, minLength: 1 }
        ),
        (angle, edges, aspect, steps) => {
          const rig = setup();
          const { cropper } = rig;

          cropper.setRotation(angle);

          if (
            aspect !== null &&
            edges[0].includes("-") &&
            edges[1].includes("-")
          ) {
            cropper.setAspect(aspect);
          }

          const { lift, move } = twoFingers(rig, edges);

          for (const [finger, kind, dx, dy] of steps) {
            const held = cropOf(cropper);

            if (kind === 0) {
              lift(finger, dx, dy);
            } else {
              move(finger, dx, dy);
            }

            expect(kind === 0 ? cropOf(cropper) : held).toStrictEqual(held);

            const state = stateOf(cropper);
            const planes = imagePlanes(state);

            for (const corner of cropCorners(state.crop)) {
              expect(insidePlanes(planes, corner, 1e-6)).toBeTruthy();
            }
          }

          cropper.destroy();
        }
      ),
      { numRuns: 200 }
    );
  });
});
