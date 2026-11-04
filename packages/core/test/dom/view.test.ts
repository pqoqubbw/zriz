import { double, assert as fcAssert, property, record } from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCropper, defaultValue } from "../../src";
import type { Aspect, CropperEvents, CropperOptions } from "../../src";
import {
  areaKeyHandlers,
  dialAria,
  dialHandlers,
  handleHandlers,
} from "../../src/dom";
import type { HandleEdge } from "../../src/dom";
import { bindZoomThumb } from "../../src/dom/controls";
import {
  cssMatrix,
  fitPlacement,
  imageMatrix,
  viewOf,
} from "../../src/dom/view";
import type { Box, Layout, Placement } from "../../src/dom/view";
import type { CropState, Size } from "../../src/geometry";
import {
  applyHomography,
  cropCorners,
  workingToSource,
} from "../../src/geometry";
import { fakeClock } from "../fake-clock";
import { stateArb } from "../geometry/arbitraries";

const layoutArb = record({
  height: double({ max: 2000, min: 100, noNaN: true }),
  inset: record({
    bottom: double({ max: 40, min: 0, noNaN: true }),
    left: double({ max: 40, min: 0, noNaN: true }),
    right: double({ max: 40, min: 0, noNaN: true }),
    top: double({ max: 40, min: 0, noNaN: true }),
  }),
  width: double({ max: 2000, min: 100, noNaN: true }),
}).map((l): Layout => ({ ...l, dpr: 1e9 }));

const cropBox = (state: CropState, { offset, scale }: Placement): Box => ({
  height: scale * state.crop.height,
  width: scale * state.crop.width,
  x: offset.x + scale * (state.crop.x - state.crop.width / 2),
  y: offset.y + scale * (state.crop.y - state.crop.height / 2),
});

describe("view geometry", () => {
  it("fits the crop inside the inset box, centred", () => {
    fcAssert(
      property(stateArb, layoutArb, (state, layout) => {
        const box = cropBox(state, fitPlacement(layout, state));
        const innerWidth =
          layout.width - layout.inset.left - layout.inset.right;
        const innerHeight =
          layout.height - layout.inset.top - layout.inset.bottom;
        expect(box.width).toBeLessThanOrEqual(innerWidth * (1 + 1e-9));
        expect(box.height).toBeLessThanOrEqual(innerHeight * (1 + 1e-9));
        expect(
          Math.max(box.width / innerWidth, box.height / innerHeight)
        ).toBeCloseTo(1, 6);
        expect(box.x + box.width / 2).toBeCloseTo(
          layout.inset.left + innerWidth / 2,
          4
        );
      })
    );
  });

  it("maps the crop corners of the photo onto the crop box", () => {
    fcAssert(
      property(
        stateArb,
        layoutArb,
        double({ max: 20, min: -20, noNaN: true }),
        double({ max: 20, min: -20, noNaN: true }),
        (base, layout, vertical, horizontal) => {
          const state = {
            ...base,
            perspective: {
              focal: 2 * Math.max(base.image.width, base.image.height),
              horizontal,
              vertical,
            },
          };
          const placement = fitPlacement(layout, state);
          const box = cropBox(state, placement);
          const matrix = imageMatrix(state, placement);
          const expected = [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x + box.width, y: box.y + box.height },
            { x: box.x, y: box.y + box.height },
          ];
          for (const [i, corner] of cropCorners(state.crop).entries()) {
            const screen = applyHomography(
              matrix,
              workingToSource(state, corner)
            );
            const want = expected[i] ?? { x: 0, y: 0 };
            const tolerance = 1e-6 * Math.max(layout.width, layout.height);
            expect(Math.abs(screen.x - want.x)).toBeLessThan(tolerance);
            expect(Math.abs(screen.y - want.y)).toBeLessThan(tolerance);
          }
        }
      )
    );
  });

  it("writes a 2D matrix without perspective and a 3D one with it", () => {
    expect(cssMatrix([1, 0, 5, 0, 1, 6, 0, 0, 1])).toBe("matrix(1,0,0,1,5,6)");
    expect(cssMatrix([1, 0, 5, 0, 1, 6, 0.001, 0, 1])).toMatch(/^matrix3d\(/u);
  });
});

describe("view", () => {
  it("snaps the published crop box to device pixels", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 777, width: 1001 },
    });
    const view = viewOf(cropper);
    view.setLayout({
      dpr: 3,
      height: 500.3,
      inset: { bottom: 11.1, left: 13.7, right: 7.2, top: 9.9 },
      width: 333.3,
    });
    const box = view.frame()?.rect;
    if (!box) {
      throw new Error("no frame");
    }
    for (const v of [box.x, box.y, box.x + box.width, box.y + box.height]) {
      expect(Math.abs(v * 3 - Math.round(v * 3))).toBeLessThan(1e-9);
    }
  });

  it("publishes a frame when the layout arrives and settles overscroll", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    const frames: number[] = [];
    view.onFrame((frame) => {
      frames.push(frame.matrix[2]);
    });
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    expect(frames).toHaveLength(1);
    const rest = frames[0] ?? 0;
    view.setOverscroll({ x: 40, y: 0 });
    time.frame();
    expect(frames.at(-1)).toBeCloseTo(rest + 40, 9);
    view.settleOverscroll();
    time.frames(60);
    expect(frames.at(-1)).toBeCloseTo(rest, 9);
    expect(time.pending()).toBe(0);
    view.destroy();
  });

  it("keeps settling overscroll when another gesture starts", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    view.setOverscroll({ x: 40, y: -30 });
    view.settleOverscroll();
    time.frames(3);
    cropper.begin("dial", undefined, "dial");
    cropper.setRotation(-10, { reason: "dial" });
    time.frames(60);
    cropper.end(undefined, "dial");
    time.frames(60);
    expect(view.overscroll()).toStrictEqual({ x: 0, y: 0 });
    expect(view.chrome().overscroll).toBeFalsy();
    view.destroy();
  });

  it("keeps settling overscroll when another gesture is cancelled", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    view.setOverscroll({ x: 40, y: -30 }, 0.8, { x: 200, y: 150 });
    view.settleOverscroll();
    time.frames(3);
    cropper.begin("resize", undefined, "handle");
    cropper.cancel(undefined, "handle");
    time.frames(120);
    expect(view.overscroll()).toStrictEqual({ x: 0, y: 0 });
    expect(view.overzoom()).toBe(1);
    expect(view.chrome().overscroll).toBeFalsy();
    view.destroy();
  });

  it("lets a zoom stretch start without stopping a running bounce", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    view.setOverscroll({ x: 0, y: 60 });
    view.settleOverscroll();
    time.frames(2);
    view.setOverscroll(null, 0.95, { x: 200, y: 150 });
    time.frames(60);
    expect(view.overscroll()).toStrictEqual({ x: 0, y: 0 });
    expect(view.overzoom()).toBe(0.95);
    view.destroy();
  });

  it("flips on the curve measured from iOS Photos, 1.35 times faster", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    const view = viewOf(cropper);
    view.setOptions({ motion: "always" });
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frame();
    const rest = view.frame()?.matrix[0] ?? 1;
    const widths = new Map<number, number>();
    view.onFrame((frame) => {
      widths.set(Math.round(time.clock.now()), frame.matrix[0] / rest);
    });
    cropper.flip();
    const start = time.clock.now();
    time.frames(60, 1000 / 240);
    const at = (ms: number): number => {
      let best = 0;
      let gap = Number.POSITIVE_INFINITY;
      for (const [t, w] of widths) {
        if (Math.abs(t - start - ms) < gap) {
          gap = Math.abs(t - start - ms);
          best = w;
        }
      }
      return best;
    };
    expect(Math.abs(at(65 / 1.35) - 0.3)).toBeLessThan(0.17);
    expect(Math.abs(at(148 / 1.35) + 0.51)).toBeLessThan(0.12);
    expect(Math.abs(at(250 / 1.35) + 0.87)).toBeLessThan(0.06);
    view.destroy();
  });

  it.each([1, 2, 3])(
    "flips across the screen after %i quarter turns",
    (turns) => {
      const time = fakeClock();
      const cropper = createCropper({
        clock: time.clock,
        image: { height: 3000, width: 4000 },
      });
      const view = viewOf(cropper);
      view.setOptions({ motion: "always" });
      view.setLayout({
        dpr: 2,
        height: 300,
        inset: { bottom: 0, left: 0, right: 0, top: 0 },
        width: 400,
      });
      for (let i = 0; i < turns; i += 1) {
        cropper.rotate90("cw");
      }
      time.frames(120);
      const rest = view.frame()?.matrix ?? [];
      const rows: number[][] = [];
      view.onFrame((frame) => {
        rows.push([...frame.matrix]);
      });
      cropper.flip();
      time.frames(120, 1000 / 120);
      for (const m of rows) {
        expect(m[3]).toBeCloseTo(rest[3] ?? 0, 6);
        expect(m[4]).toBeCloseTo(rest[4] ?? 0, 6);
      }
      const end = rows.at(-1) ?? [];
      expect(end[0]).toBeCloseTo(-(rest[0] ?? 0), 6);
      expect(end[1]).toBeCloseTo(-(rest[1] ?? 0), 6);
      view.destroy();
    }
  );
});

describe("view lifetime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops its timers with the cropper", () => {
    vi.useFakeTimers();
    const { clock } = fakeClock();
    const cropper = createCropper({
      clock,
      image: { height: 100, width: 100 },
    });
    const view = viewOf(cropper);
    view.setLayout({
      dpr: 1,
      height: 600,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 800,
    });
    cropper.begin("resize");
    view.hold();
    view.release();
    cropper.end();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    cropper.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(viewOf(cropper)).not.toBe(view);
  });
});

const pressKey = (
  press: (event: KeyboardEvent) => void,
  name: string
): void => {
  Reflect.apply(press, undefined, [
    { key: name, preventDefault: () => {}, shiftKey: false },
  ]);
};

const photoCropper = (options: CropperOptions = {}) => {
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 3000, width: 4000 },
    ...options,
  });
  return { cropper, time };
};

const limitAngle = (
  value: { rotation: number },
  details: { cancel: () => void }
): void => {
  if (value.rotation > 10) {
    details.cancel();
  }
};

describe("a rejected change", () => {
  it.each([true, false])(
    "leaves the dial's aria at the value that stayed, canceller first: %s",
    (first) => {
      const { cropper, time } = photoCropper(
        first ? { onValueChange: limitAngle } : {}
      );
      const attrs = new Map<string, string>();
      Reflect.apply(dialAria, undefined, [
        cropper,
        {
          setAttribute: (name: string, next: string) => {
            attrs.set(name, next);
          },
          toggleAttribute: () => {},
        },
      ]);
      if (!first) {
        cropper.on("change", limitAngle);
      }
      const dial = dialHandlers(cropper);
      cropper.setRotation(10);
      time.frames(3);
      pressKey(dial.onKeyDown, "ArrowRight");
      time.frames(2);
      pressKey(dial.onKeyUp, "ArrowRight");
      time.frames(5);
      expect(cropper.getValue().rotation).toBe(10);
      expect(attrs.get("aria-valuenow")).toBe("10");
    }
  );

  it("runs no transition and never settles", () => {
    const { cropper, time } = photoCropper({
      onValueChange: (_, details) => {
        details.cancel();
      },
    });
    const view = viewOf(cropper);
    view.setOptions({ motion: "always" });
    view.setLayout({
      dpr: 2,
      height: 300,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width: 400,
    });
    time.frames(3);
    const settle = vi.fn<() => void>();
    const settling: boolean[] = [];
    cropper.on("settle", settle);
    cropper.subscribe(() => {
      settling.push(cropper.getState().settling);
    });
    cropper.flip();
    time.frames(30);
    expect(cropper.getValue().mirrored).toBeFalsy();
    expect(settle).not.toHaveBeenCalled();
    expect(settling).not.toContain(true);
    view.destroy();
  });
});

const minCropper = (
  min: number,
  viewport = 1000,
  { aspect = "free", ...options }: CropperOptions & { aspect?: Aspect } = {}
) => {
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("Element", Object);
  vi.stubGlobal("document", {
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 1000, width: 1000 },
    minSize: { height: min, width: min },
    value: { ...defaultValue, aspect },
    ...options,
  });
  viewOf(cropper).setLayout({
    dpr: 1,
    height: viewport,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: viewport,
  });
  return { cropper, time };
};

const edgeShare = (edge: HandleEdge, before: string, after: string): number => {
  if (edge.includes(before)) {
    return 0;
  }
  return edge.includes(after) ? 1 : 0.5;
};

const pointerAt = (clientX: number, clientY: number) => [
  {
    button: 0,
    clientX,
    clientY,
    currentTarget: null,
    pointerId: 1,
    pointerType: "mouse",
  },
];

const dragEdge = (
  { cropper, time }: ReturnType<typeof minCropper>,
  edge: HandleEdge,
  dx: number,
  dy = 0
): void => {
  const rect = viewOf(cropper).frame()?.rect;
  const x =
    (rect?.x ?? 0) + (rect?.width ?? 0) * edgeShare(edge, "left", "right");
  const y =
    (rect?.y ?? 0) + (rect?.height ?? 0) * edgeShare(edge, "top", "bottom");
  const handlers = handleHandlers(cropper, edge);
  Reflect.apply(handlers.onPointerDown, undefined, pointerAt(x, y));
  Reflect.apply(handlers.onPointerMove, undefined, pointerAt(x + dx, y + dy));
  time.frame();
  Reflect.apply(handlers.onPointerUp, undefined, pointerAt(x + dx, y + dy));
  time.frame();
};

describe("a handle at minSize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [800, 1000],
    [512, 500],
  ])("stops at a minimum of %s in a %s px viewport", (min, viewport) => {
    const context = minCropper(min, viewport);
    dragEdge(context, "right", -viewport);
    expect(context.cropper.getPixelCrop()?.pixelRect?.width).toBe(min);
  });

  it.each([
    ["bottom", -2000, 200],
    ["top", 2000, 600],
  ] as const)(
    "stops the %s handle at the minimum height with the far edge in place",
    (edge, dy, top) => {
      const context = minCropper(200);
      context.cropper.setValue({ size: { height: 0.6, width: 0.6 } });
      dragEdge(context, edge, 0, dy);
      expect(context.cropper.getPixelCrop()?.pixelRect).toStrictEqual({
        height: 200,
        left: 200,
        top,
        width: 600,
      });
    }
  );

  it.each<[string, Size, number, Size, HandleEdge, number]>([
    [
      "a tall photo",
      { height: 800, width: 300 },
      1,
      { height: 512, width: 512 },
      "bottom-right",
      -1,
    ],
    [
      "a wide photo",
      { height: 2000, width: 3000 },
      3,
      { height: 1500, width: 100 },
      "bottom-right",
      -1,
    ],
    [
      "a square photo",
      { height: 1000, width: 1000 },
      16 / 9,
      { height: 800, width: 800 },
      "top-left",
      1,
    ],
  ])(
    "moves a locked crop under its minimum by no more than the drag on %s",
    (_, image, aspect, minSize, edge, inward) => {
      const context = minCropper(1, 1000, { aspect, image, minSize });
      const { cropper } = context;
      const before = cropper.getCropState()?.crop;
      const scale = viewOf(cropper).frame()?.scale ?? 1;
      dragEdge(context, edge, inward, inward);
      const after = cropper.getCropState()?.crop;
      expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(
        2 / scale
      );
      expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(
        2 / scale
      );
    }
  );

  it("keeps the other side and the opposite edge where they were", () => {
    const context = minCropper(200);
    context.cropper.setValue({ size: { height: 0.3, width: 0.6 } });
    dragEdge(context, "right", -2000);
    expect(context.cropper.getPixelCrop()?.pixelRect).toStrictEqual({
      height: 300,
      left: 200,
      top: 350,
      width: 200,
    });
  });
});

const held = (
  { cropper }: ReturnType<typeof minCropper>,
  edge: HandleEdge,
  dx: number,
  dy = 0
) => {
  const rect = viewOf(cropper).frame()?.rect;
  const x =
    (rect?.x ?? 0) + (rect?.width ?? 0) * edgeShare(edge, "left", "right");
  const y =
    (rect?.y ?? 0) + (rect?.height ?? 0) * edgeShare(edge, "top", "bottom");
  const handlers = handleHandlers(cropper, edge);
  Reflect.apply(handlers.onPointerDown, undefined, pointerAt(x, y));
  Reflect.apply(handlers.onPointerMove, undefined, pointerAt(x + dx, y + dy));
  return cropper.getCropState()?.crop ?? { height: 0, width: 0, x: 0, y: 0 };
};

const thinCropper = (
  image: Size,
  viewport: number,
  options: CropperOptions & { aspect?: Aspect } = {}
) => minCropper(1, viewport, { image, minSize: undefined, ...options });

describe("a handle on a crop under the 88 px floor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<[string, Size, number, number]>([
    ["a panorama inward", { height: 1500, width: 8000 }, 382, 111],
    ["a panorama outward", { height: 1500, width: 8000 }, 382, -20],
    [
      "onto the far edge of a clean scale",
      { height: 100, width: 1000 },
      500,
      50,
    ],
    ["past the far edge", { height: 100, width: 2000 }, 400, 400],
  ])("keeps the crop whole when pulled %s", (_, image, viewport, dy) => {
    const crop = held(thinCropper(image, viewport), "top", 0, dy);
    expect(crop).toStrictEqual({
      height: image.height,
      width: image.width,
      x: 0,
      y: 0,
    });
  });

  it("keeps a corner inside the photo", () => {
    const context = thinCropper({ height: 1500, width: 8000 }, 382);
    const crop = held(context, "top-left", 400, 400);
    expect(crop.width).toBeLessThanOrEqual(8000);
    expect(crop.width * (382 / 8000)).toBeGreaterThanOrEqual(88 - 1e-6);
    expect(crop.height).toBe(1500);
    expect(crop.x + crop.width / 2).toBeCloseTo(4000, 6);
  });

  it.each<[string, Size, number, Aspect, number, HandleEdge]>([
    ["a free crop", { height: 2000, width: 2000 }, 400, "free", 1, "bottom"],
    ["a locked banner", { height: 3000, width: 4000 }, 400, 5, 2, "right"],
    ["a locked strip", { height: 3000, width: 4000 }, 64, 16 / 9, 2, "bottom"],
    [
      "the original shape",
      { height: 1800, width: 8000 },
      390,
      "original",
      2,
      "top",
    ],
  ])(
    "does not jump or commit at zero motion on %s",
    (_, image, viewport, aspect, zoom, edge) => {
      const context = thinCropper(image, viewport, { aspect });
      const { cropper, time } = context;
      if (aspect === "free") {
        cropper.setValue({ size: { height: 0.12, width: 1 } });
      }
      cropper.setZoom(zoom);
      time.frames(2);
      const onCommit = vi.fn<CropperEvents["commit"]>();
      cropper.on("commit", (...args) => {
        onCommit(...args);
      });
      const before = cropper.getCropState()?.crop;
      dragEdge(context, edge, 0);
      const crop = cropper.getCropState()?.crop;
      expect(crop?.width).toBeCloseTo(before?.width ?? 0, 6);
      expect(crop?.height).toBeCloseTo(before?.height ?? 0, 6);
      expect(crop?.x).toBeCloseTo(before?.x ?? 0, 6);
      expect(crop?.y).toBeCloseTo(before?.y ?? 0, 6);
      expect(onCommit).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["grows from where it is", 1, 245],
    ["cannot shrink", -30, 240],
  ])("%s", (_, dy, height) => {
    const context = thinCropper({ height: 2000, width: 2000 }, 400);
    context.cropper.setValue({ size: { height: 0.12, width: 1 } });
    context.time.frames(2);
    expect(held(context, "bottom", 0, dy).height).toBeCloseTo(height);
  });
});

const atCeiling = (
  maxZoom: number,
  size: { height: number; width: number }
) => {
  const context = thinCropper({ height: 3000, width: 4000 }, 400, {
    maxZoom,
  });
  context.cropper.setValue({ size });
  context.cropper.setZoom(maxZoom);
  context.time.frames(2);
  return context;
};

describe("a handle at the zoom ceiling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [15, -100],
    [15, -300],
    [8, -100],
  ])(
    "keeps the far corner at max zoom %s when a corner moves %s px in",
    (maxZoom, inward) => {
      const context = atCeiling(maxZoom, {
        height: 1 / maxZoom,
        width: 1 / maxZoom,
      });
      const before = context.cropper.getCropState()?.crop;
      const crop = held(context, "bottom-right", inward, inward);
      expect(crop.x - crop.width / 2).toBeCloseTo(
        (before?.x ?? 0) - (before?.width ?? 0) / 2,
        6
      );
      expect(crop.y - crop.height / 2).toBeCloseTo(
        (before?.y ?? 0) - (before?.height ?? 0) / 2,
        6
      );
      expect(context.cropper.getZoom()).toBeCloseTo(maxZoom, 6);
    }
  );

  it("keeps the other side and the far edge when an edge moves in", () => {
    const context = atCeiling(15, { height: 1 / 30, width: 1 / 15 });
    const before = context.cropper.getCropState()?.crop;
    const crop = held(context, "right", -50);
    expect(crop.height).toBeCloseTo(before?.height ?? 0, 6);
    expect(crop.x - crop.width / 2).toBeCloseTo(
      (before?.x ?? 0) - (before?.width ?? 0) / 2,
      6
    );
  });

  it.each([
    ["out", 40, 126.667],
    ["in", -20, 86.667],
  ])(
    "lets the free side of a corner follow the pointer %s",
    (_, dy, height) => {
      const context = atCeiling(15, { height: 1 / 30, width: 1 / 15 });
      const before = context.cropper.getCropState()?.crop;
      const crop = held(context, "bottom-right", -50, dy);
      expect(crop.height).toBeCloseTo(height, 2);
      expect(crop.width).toBeCloseTo(before?.width ?? 0, 6);
      expect(crop.y - crop.height / 2).toBeCloseTo(
        (before?.y ?? 0) - (before?.height ?? 0) / 2,
        6
      );
      expect(context.cropper.getZoom()).toBeCloseTo(15, 6);
    }
  );

  it.each<[string, [number, number][]]>([
    ["one jump", [[-120, -60]]],
    [
      "the y side first",
      [
        [0, -60],
        [-120, -60],
      ],
    ],
    [
      "the x side first",
      [
        [-120, 0],
        [-120, -60],
      ],
    ],
    [
      "four steps",
      [
        [-30, -15],
        [-60, -30],
        [-90, -45],
        [-120, -60],
      ],
    ],
    [
      "a trip past the ceiling and back",
      [
        [-300, 0],
        [-120, -60],
      ],
    ],
  ])("ends a corner drag on the same crop after %s", (_, moves) => {
    const context = atCeiling(4, { height: 0.5, width: 1 });
    context.cropper.setZoom(3.5);
    context.time.frames(2);
    const rect = viewOf(context.cropper).frame()?.rect;
    const x = (rect?.x ?? 0) + (rect?.width ?? 0);
    const y = (rect?.y ?? 0) + (rect?.height ?? 0);
    const handlers = handleHandlers(context.cropper, "bottom-right");
    Reflect.apply(handlers.onPointerDown, undefined, pointerAt(x, y));
    for (const [dx, dy] of moves) {
      Reflect.apply(
        handlers.onPointerMove,
        undefined,
        pointerAt(x + dx, y + dy)
      );
    }
    const crop = context.cropper.getCropState()?.crop;
    expect(crop?.width).toBeCloseTo(1000, 4);
    expect(crop?.height).toBeCloseTo(257.143, 2);
  });

  it.each([
    ["the width", -120, -100, 1000, 666.667],
    ["the height", -160, -100, 800, 750],
  ])(
    "gives back the smaller share of %s when both sides could set the zoom",
    (_, dx, dy, width, height) => {
      const context = atCeiling(4, { height: 1, width: 1 });
      context.cropper.setZoom(3);
      context.time.frames(2);
      const crop = held(context, "bottom-right", dx, dy);
      expect(crop.width).toBeCloseTo(width, 2);
      expect(crop.height).toBeCloseTo(height, 2);
    }
  );

  it.each([
    ["top right", 20, 4000, -4000],
    ["bottom right", -20, 4000, 4000],
  ])(
    "keeps the far corner on a straightened crop against the %s of the photo",
    (_, angle, panX, panY) => {
      const context = atCeiling(4, { height: 0.5, width: 1 });
      context.cropper.setRotation(angle);
      context.cropper.setZoom(4);
      context.time.frames(2);
      context.cropper.panBy(panX, panY);
      context.time.frames(2);
      const before = context.cropper.getCropState()?.crop;
      const crop = held(context, "bottom-right", -60, 80);
      expect(crop.x - crop.width / 2).toBeCloseTo(
        (before?.x ?? 0) - (before?.width ?? 0) / 2,
        6
      );
      expect(crop.y - crop.height / 2).toBeCloseTo(
        (before?.y ?? 0) - (before?.height ?? 0) / 2,
        6
      );
    }
  );

  it("keeps a locked corner in shape at the ceiling", () => {
    const context = thinCropper({ height: 3000, width: 4000 }, 400, {
      aspect: 2,
      maxZoom: 4,
    });
    context.cropper.setZoom(3.5);
    context.time.frames(2);
    const crop = held(context, "bottom-right", -100, -100);
    expect(crop.width / crop.height).toBeCloseTo(2, 6);
    expect(crop.width).toBeCloseTo(1000, 4);
  });

  it("still shrinks the side that does not set the zoom", () => {
    const context = atCeiling(15, { height: 1 / 30, width: 1 / 15 });
    const before = context.cropper.getCropState()?.crop;
    const crop = held(context, "bottom", 0, -5);
    expect(crop.height).toBeLessThan(before?.height ?? 0);
    expect(crop.width).toBeCloseTo(before?.width ?? 0, 6);
  });
});

const keyboard = (context: ReturnType<typeof minCropper>) => {
  const keys = areaKeyHandlers(context.cropper);
  return (key: string, times = 1, shiftKey = false): CropState["crop"] => {
    for (let index = 0; index < times; index += 1) {
      const event = {
        altKey: true,
        key,
        preventDefault: () => {},
        shiftKey,
      };
      Reflect.apply(keys.onKeyDown, undefined, [event]);
      context.time.frame();
      Reflect.apply(keys.onKeyUp, undefined, [event]);
      context.time.frames(2);
    }
    return (
      context.cropper.getCropState()?.crop ?? {
        height: 0,
        width: 0,
        x: 0,
        y: 0,
      }
    );
  };
};

describe("alt arrows on a free crop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const photo = { height: 3000, width: 4000 };

  it("changes only the pressed side with room to grow", () => {
    const context = thinCropper(photo, 1000);
    context.cropper.setZoom(2);
    context.time.frames(2);
    const crop = keyboard(context)("ArrowRight");
    expect(crop.width).toBeCloseTo(2020, 6);
    expect(crop.height).toBeCloseTo(1500, 6);
    expect(crop.x).toBe(0);
  });

  it.each([
    ["ArrowRight", { height: 3000, width: 4000 }],
    ["ArrowDown", { height: 3000, width: 4000 }],
  ])("leaves a full crop alone on %s", (key, size) => {
    const crop = keyboard(thinCropper(photo, 1000))(key, 10);
    expect(crop.width).toBeCloseTo(size.width, 6);
    expect(crop.height).toBeCloseTo(size.height, 6);
  });

  it("stops the pressed side at the photo edge and holds the other", () => {
    const context = thinCropper(photo, 1000);
    context.cropper.setZoom(2);
    context.time.frames(2);
    const crop = keyboard(context)("ArrowRight", 80);
    expect(crop.width).toBeCloseTo(4000, 6);
    expect(crop.height).toBeCloseTo(1500, 6);
  });

  it("keeps the other side and the centre on a straightened crop", () => {
    const context = thinCropper(photo, 1000);
    context.cropper.setRotation(10);
    context.time.frames(2);
    const before = context.cropper.getCropState()?.crop;
    const crop = keyboard(context)("ArrowRight", 10);
    expect(crop.height).toBeCloseTo(before?.height ?? 0, 6);
    expect(crop.x).toBeCloseTo(before?.x ?? 0, 6);
    expect(crop.y).toBeCloseTo(before?.y ?? 0, 6);
  });

  it("stops at the minimum size on both axes", () => {
    const context = thinCropper(photo, 1000, {
      minSize: { height: 512, width: 512 },
    });
    expect(keyboard(context)("ArrowLeft", 60, true).width).toBeCloseTo(512, 6);
    expect(keyboard(context)("ArrowUp", 60, true).height).toBeCloseTo(512, 6);
  });

  it("leaves a crop already under the 88 px floor alone on a shrink key", () => {
    const context = thinCropper({ height: 2000, width: 2000 }, 400);
    context.cropper.setValue({ size: { height: 0.1, width: 0.5 } });
    context.time.frames(2);
    const before = context.cropper.getCropState()?.crop;
    const scale = viewOf(context.cropper).frame()?.scale ?? 1;
    expect((before?.height ?? 0) * scale).toBeLessThan(88);
    const crop = keyboard(context)("ArrowUp", 3, true);
    expect(crop.height).toBeCloseTo(before?.height ?? 0, 6);
    expect(crop.width).toBeCloseTo(before?.width ?? 0, 6);
  });

  it("stops at the 88 px floor", () => {
    const context = thinCropper(photo, 800);
    const crop = keyboard(context)("ArrowLeft", 60, true);
    const scale = viewOf(context.cropper).frame()?.scale ?? 1;
    expect(crop.width * scale).toBeGreaterThanOrEqual(88 - 1e-6);
    expect(crop.height).toBeCloseTo(3000, 6);
  });

  it("holds the other side at the zoom ceiling", () => {
    const context = thinCropper(photo, 400, { maxZoom: 15 });
    context.cropper.setValue({ size: { height: 1 / 30, width: 1 / 15 } });
    context.cropper.setZoom(15);
    context.time.frames(2);
    const before = context.cropper.getCropState()?.crop;
    const crop = keyboard(context)("ArrowLeft", 5);
    expect(crop.height).toBeCloseTo(before?.height ?? 0, 6);
    expect(crop.width).toBeCloseTo(before?.width ?? 0, 6);
  });

  it("keeps a locked crop in shape and stops it at the minimum", () => {
    const context = thinCropper(photo, 1000, {
      aspect: 1,
      minSize: { height: 512, width: 512 },
    });
    const crop = keyboard(context)("ArrowLeft", 60, true);
    expect(crop.width).toBeCloseTo(512, 6);
    expect(crop.height).toBeCloseTo(512, 6);
  });
});

describe("zoom thumb", () => {
  it("does not write the style while the zoom stands still", () => {
    const { cropper, time } = photoCropper();
    cropper.setZoom(2);
    time.frames(2);
    const writes: string[] = [];
    const style = {
      get insetInlineStart(): string {
        return writes.at(-1) ?? "";
      },
      set insetInlineStart(next: string) {
        writes.push(next);
      },
      position: "",
    };
    Reflect.apply(bindZoomThumb, undefined, [cropper, { style }]);
    writes.length = 0;
    for (let step = 0; step < 100; step += 1) {
      cropper.panBy(Math.sin(step / 7) * 0.01, Math.cos(step / 11) * 0.01);
      time.frame();
    }
    expect(writes).toStrictEqual([]);
  });
});
