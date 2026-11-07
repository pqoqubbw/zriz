import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cropper } from "../../src";
import { handleHandlers } from "../../src/dom/parts";
import type { HandleEdge } from "../../src/dom/parts";
import { fitPlacement, viewOf } from "../../src/dom/view";
import type { Layout, Placement } from "../../src/dom/view";
import type { Point, Rect } from "../../src/geometry";
import { pointer as fakePointer, setup, stateOf } from "../cropper-fixture";

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
  init: { button?: number; pointerId?: number } = {}
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

const press = (cropper: Cropper, edge: HandleEdge, at: Point) => {
  const handlers = handleHandlers(cropper, edge, () => null);

  handlers.onPointerDown(pointer(at));

  return handlers;
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
});
