import { double, assert as fcAssert, property, record } from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultValue } from "../../src";
import type {
  Aspect,
  Cropper,
  CropperEvents,
  CropperOptions,
  CropValue,
} from "../../src";
import {
  areaKeyHandlers,
  bindImage,
  bindMask,
  dialAria,
  dialHandlers,
  handleHandlers,
} from "../../src/dom";
import type { HandleEdge } from "../../src/dom";
import { bindZoomThumb } from "../../src/dom/controls";
import { fitPlacement, imageMatrix, viewOf } from "../../src/dom/view";
import type { Box, Layout, Placement, ViewFrame } from "../../src/dom/view";
import type { CropState, Size } from "../../src/geometry";
import {
  applyHomography,
  cropCorners,
  workingToSource,
} from "../../src/geometry";
import {
  cast,
  isObject,
  key,
  LAYOUT,
  laidOut,
  PHOTO,
  pointer,
  setup,
  stateOf,
} from "../cropper-fixture";
import type { FakeClock } from "../fake-clock";
import { stateArb } from "../geometry/arbitraries";

type View = ReturnType<typeof viewOf>;

const pointerAt = (clientX: number, clientY: number): PointerEvent => {
  const init = { clientY, currentTarget: null };

  return pointer(clientX, 0, init);
};

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
});

describe("view", () => {
  it("snaps the rect behind the mask inward to device pixels", () => {
    const { cropper } = setup({ image: { height: 777, width: 1001 } });
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

  it.each([
    [
      "a dial gesture",
      (cropper: Cropper, view: View, time: FakeClock) => {
        view.setOverscroll({ x: 40, y: -30 });
        view.settleOverscroll();
        time.frames(3);
        cropper.begin("dial", undefined, "dial");
        cropper.setRotation(-10, { reason: "dial" });
        time.frames(60);
        cropper.end(undefined, "dial");
      },
      1,
    ],
    [
      "a cancelled handle drag",
      (cropper: Cropper, view: View, time: FakeClock) => {
        view.setOverscroll({ x: 40, y: -30 }, 0.8, { x: 200, y: 150 });
        view.settleOverscroll();
        time.frames(3);
        cropper.begin("resize", undefined, "handle");
        cropper.cancel(undefined, "handle");
      },
      1,
    ],
    [
      "a zoom stretch",
      (_cropper: Cropper, view: View, time: FakeClock) => {
        view.setOverscroll({ x: 0, y: 60 });
        view.settleOverscroll();
        time.frames(2);
        view.setOverscroll(null, 0.95, { x: 200, y: 150 });
      },
      0.95,
    ],
  ])("lets a running bounce land at 0 through %s", (_name, act, overzoom) => {
    const { cropper, time, view } = laidOut(
      { image: PHOTO },
      { ...LAYOUT, dpr: 2 }
    );

    time.frame();
    act(cropper, view, time);
    time.frames(120);
    expect(view.overscroll()).toStrictEqual({ x: 0, y: 0 });
    expect(view.overzoom()).toBe(overzoom);
    expect(view.chrome().overscroll).toBe(overzoom !== 1);
    view.destroy();
  });

  it("flips on the curve measured from iOS Photos, 1.35 times faster", () => {
    const { cropper, time } = setup({
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
      widths.set(Math.round(time.now()), frame.matrix[0] / rest);
    });

    cropper.flip();
    const start = time.now();

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

  it.each([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 12],
    [1, 12],
  ])(
    "flips along one screen axis after %i quarter turns at %d°",
    (turns, degrees) => {
      const { cropper, time, view } = laidOut(
        { image: PHOTO },
        { ...LAYOUT, dpr: 2 }
      );

      view.setOptions({ motion: "always" });

      for (let i = 0; i < turns; i += 1) {
        cropper.rotate90("cw");
      }

      cropper.setRotation(degrees, { emit: false });
      time.frames(120);
      const rest = view.frame()?.matrix ?? [];
      const rows: number[][] = [];

      view.onFrame((frame) => {
        rows.push([...frame.matrix]);
      });

      cropper.flip();
      time.frames(120, 1000 / 120);
      const still = (from: number): boolean =>
        rows.every(
          (m) =>
            Math.abs((m[from] ?? 0) - (rest[from] ?? 0)) < 1e-6 &&
            Math.abs((m[from + 1] ?? 0) - (rest[from + 1] ?? 0)) < 1e-6
        );
      const moved = still(3) ? 0 : 3;
      const end = rows.at(-1) ?? [];

      expect(rows.length).toBeGreaterThan(10);
      expect(still(3 - moved)).toBeTruthy();
      expect(end[moved]).toBeCloseTo(-(rest[moved] ?? 0), 6);
      expect(end[moved + 1]).toBeCloseTo(-(rest[moved + 1] ?? 0), 6);
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
    const { cropper } = setup({
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
  });
});

const photoCropper = (options: CropperOptions = {}) => setup(options);

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
      dial.onKeyDown(key({ key: "ArrowRight" }));
      time.frames(2);
      dial.onKeyUp(key({ key: "ArrowRight" }));
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

  const { cropper, time } = setup({
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

  handlers.onPointerDown(pointerAt(x, y));
  handlers.onPointerMove(pointerAt(x + dx, y + dy));
  time.frame();
  handlers.onPointerUp(pointerAt(x + dx, y + dy));
  time.frame();
};

describe("a handle at minSize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<
    [string, number, number, Size | null, HandleEdge, number, number, object]
  >([
    [
      "at a minimum of 800 in a 1000 px viewport",
      800,
      1000,
      null,
      "right",
      -1000,
      0,
      { width: 800 },
    ],
    [
      "at a minimum of 512 in a 500 px viewport",
      512,
      500,
      null,
      "right",
      -500,
      0,
      { width: 512 },
    ],
    [
      "the bottom handle at the minimum height with the far edge in place",
      200,
      1000,
      { height: 0.6, width: 0.6 },
      "bottom",
      0,
      -2000,
      { height: 200, left: 200, top: 200, width: 600 },
    ],
    [
      "the top handle at the minimum height with the far edge in place",
      200,
      1000,
      { height: 0.6, width: 0.6 },
      "top",
      0,
      2000,
      { height: 200, left: 200, top: 600, width: 600 },
    ],
    [
      "a side with the other side and the opposite edge in place",
      200,
      1000,
      { height: 0.3, width: 0.6 },
      "right",
      -2000,
      0,
      { height: 300, left: 200, top: 350, width: 200 },
    ],
  ])("stops %s", (_name, min, viewport, size, edge, dx, dy, pixelRect) => {
    const context = minCropper(min, viewport);

    if (size) {
      context.cropper.setValue({ size });
    }

    dragEdge(context, edge, dx, dy);
    expect(context.cropper.getPixelCrop()?.pixelRect).toMatchObject(pixelRect);
  });

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

  handlers.onPointerDown(pointerAt(x, y));
  handlers.onPointerMove(pointerAt(x + dx, y + dy));

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

  it.each<[string, Size, number, HandleEdge, number, object]>([
    [
      "a panorama pulled inward",
      { height: 1500, width: 8000 },
      382,
      "top",
      111,
      { height: 1500, width: 8000, x: 0, y: 0 },
    ],
    [
      "a panorama pulled outward",
      { height: 1500, width: 8000 },
      382,
      "top",
      -20,
      { height: 1500, width: 8000, x: 0, y: 0 },
    ],
    [
      "a crop pulled onto the far edge of a clean scale",
      { height: 100, width: 1000 },
      500,
      "top",
      50,
      { height: 100, width: 1000, x: 0, y: 0 },
    ],
    [
      "a crop pulled past the far edge",
      { height: 100, width: 2000 },
      400,
      "top",
      400,
      { height: 100, width: 2000, x: 0, y: 0 },
    ],
    [
      "a panorama corner pulled in",
      { height: 1500, width: 8000 },
      382,
      "top-left",
      400,
      { height: 1500 },
    ],
  ])(
    "keeps %s inside the photo and over the floor",
    (_name, image, viewport, edge, d, expected) => {
      const crop = held(
        thinCropper(image, viewport),
        edge,
        edge === "top" ? 0 : d,
        d
      );

      expect(crop).toMatchObject(expected);
      expect(crop.width).toBeLessThanOrEqual(image.width);

      expect(crop.width * (viewport / image.width)).toBeGreaterThanOrEqual(
        88 - 1e-6
      );

      expect(crop.x + crop.width / 2).toBeCloseTo(image.width / 2, 6);
    }
  );

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

type Side =
  | "bottom"
  | "height"
  | "left"
  | "right"
  | "screenWidth"
  | "top"
  | "width"
  | "x"
  | "y"
  | "zoom";

const sides = (cropper: Cropper): Record<Side, number> => {
  const { height, width, x, y } = cropper.getCropState()?.crop ?? {
    height: 0,
    width: 0,
    x: 0,
    y: 0,
  };

  return {
    bottom: y + height / 2,
    height,
    left: x - width / 2,
    right: x + width / 2,
    screenWidth: width * (viewOf(cropper).frame()?.scale ?? 1),
    top: y - height / 2,
    width,
    x,
    y,
    zoom: cropper.getZoom(),
  };
};

const pick = (
  from: Record<Side, number>,
  keys: Side[]
): Partial<Record<Side, number>> =>
  Object.fromEntries(keys.map((name) => [name, from[name]]));

const near = (
  values: Partial<Record<Side, number>>,
  digits: number
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      expect.closeTo(value, digits),
    ])
  );

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

  it.each<
    [
      string,
      number,
      Size,
      number,
      [number, number],
      HandleEdge,
      number,
      number,
      Side[],
    ]
  >([
    [
      "a corner 100 px in at 15x",
      15,
      { height: 1 / 15, width: 1 / 15 },
      0,
      [0, 0],
      "bottom-right",
      -100,
      -100,
      ["left", "top", "zoom"],
    ],
    [
      "a corner 300 px in at 15x",
      15,
      { height: 1 / 15, width: 1 / 15 },
      0,
      [0, 0],
      "bottom-right",
      -300,
      -300,
      ["left", "top", "zoom"],
    ],
    [
      "a corner 100 px in at 8x",
      8,
      { height: 1 / 8, width: 1 / 8 },
      0,
      [0, 0],
      "bottom-right",
      -100,
      -100,
      ["left", "top", "zoom"],
    ],
    [
      "an edge moving in",
      15,
      { height: 1 / 30, width: 1 / 15 },
      0,
      [0, 0],
      "right",
      -50,
      0,
      ["height", "left"],
    ],
    [
      "a straightened crop against the top right",
      4,
      { height: 0.5, width: 1 },
      20,
      [4000, -4000],
      "bottom-right",
      -60,
      80,
      ["left", "top"],
    ],
    [
      "a straightened crop against the bottom right",
      4,
      { height: 0.5, width: 1 },
      -20,
      [4000, 4000],
      "bottom-right",
      -60,
      80,
      ["left", "top"],
    ],
  ])(
    "stops %s at the ceiling and keeps the far edge and the other side",
    (_name, maxZoom, size, angle, [panX, panY], edge, dx, dy, kept) => {
      const context = atCeiling(maxZoom, size);

      context.cropper.setRotation(angle);
      context.cropper.setZoom(maxZoom);
      context.time.frames(2);
      context.cropper.panBy(panX, panY);
      context.time.frames(2);
      const before = sides(context.cropper);

      held(context, edge, dx, dy);

      expect(sides(context.cropper)).toMatchObject(near(pick(before, kept), 6));
    }
  );

  it("still shrinks the side that does not set the zoom", () => {
    const context = atCeiling(15, { height: 1 / 30, width: 1 / 15 });
    const before = context.cropper.getCropState()?.crop;
    const crop = held(context, "bottom", 0, -5);

    expect(crop.height).toBeLessThan(before?.height ?? 0);
    expect(crop.width).toBeCloseTo(before?.width ?? 0, 6);
  });

  it.each<
    [
      string,
      number,
      Size,
      number,
      number,
      number,
      Partial<Record<Side, number>>,
      Side[],
    ]
  >([
    [
      "the free side following the pointer out",
      15,
      { height: 1 / 30, width: 1 / 15 },
      15,
      -50,
      40,
      { height: 126.667 },
      ["width", "top", "zoom"],
    ],
    [
      "the free side following the pointer in",
      15,
      { height: 1 / 30, width: 1 / 15 },
      15,
      -50,
      -20,
      { height: 86.667 },
      ["width", "top", "zoom"],
    ],
    [
      "the smaller share of the width",
      4,
      { height: 1, width: 1 },
      3,
      -120,
      -100,
      { height: 666.667, width: 1000 },
      [],
    ],
    [
      "the smaller share of the height",
      4,
      { height: 1, width: 1 },
      3,
      -160,
      -100,
      { height: 750, width: 800 },
      [],
    ],
  ])(
    "stops each side of a free corner on its own: %s",
    (_name, maxZoom, size, zoom, dx, dy, expected, kept) => {
      const context = atCeiling(maxZoom, size);

      context.cropper.setZoom(zoom);
      context.time.frames(2);
      const before = sides(context.cropper);

      held(context, "bottom-right", dx, dy);

      expect(sides(context.cropper)).toMatchObject({
        ...near(pick(before, kept), 6),
        ...near(expected, 2),
      });
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

    handlers.onPointerDown(pointerAt(x, y));

    for (const [dx, dy] of moves) {
      handlers.onPointerMove(pointerAt(x + dx, y + dy));
    }

    const crop = context.cropper.getCropState()?.crop;

    expect(crop?.width).toBeCloseTo(1000, 4);
    expect(crop?.height).toBeCloseTo(257.143, 2);
  });

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
});

const keyboard = (context: ReturnType<typeof minCropper>) => {
  const keys = areaKeyHandlers(context.cropper);

  return (name: string, times = 1, shiftKey = false): CropState["crop"] => {
    for (let index = 0; index < times; index += 1) {
      const event = key({ altKey: true, key: name, shiftKey });

      keys.onKeyDown(event);
      context.time.frame();
      keys.onKeyUp(event);
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

  it.each<
    [
      string,
      number,
      number | null,
      number,
      Partial<Record<Side, number>>,
      Side[],
    ]
  >([
    ["level", 0, 2, 1, { height: 1500, width: 2020, x: 0 }, []],
    ["straightened", 10, null, 10, {}, ["height", "x", "y"]],
  ])(
    "changes only the pressed side and keeps the centre on a %s crop",
    (_name, rotation, zoom, times, expected, kept) => {
      const context = thinCropper(photo, 1000);

      context.cropper.setRotation(rotation);

      if (zoom !== null) {
        context.cropper.setZoom(zoom);
      }

      context.time.frames(2);
      const before = sides(context.cropper);

      keyboard(context)("ArrowRight", times);

      expect(sides(context.cropper)).toMatchObject({
        ...near(pick(before, kept), 6),
        ...near(expected, 6),
      });
    }
  );

  it.each<
    [
      string,
      Size,
      number,
      CropperOptions & { aspect?: Aspect },
      Partial<CropValue> | null,
      number | null,
      [string, number, boolean][],
      Partial<Record<Side, number>>,
      Side[],
    ]
  >([
    [
      "a full crop on ArrowRight",
      photo,
      1000,
      {},
      null,
      null,
      [["ArrowRight", 10, false]],
      { height: 3000, width: 4000 },
      [],
    ],
    [
      "a full crop on ArrowDown",
      photo,
      1000,
      {},
      null,
      null,
      [["ArrowDown", 10, false]],
      { height: 3000, width: 4000 },
      [],
    ],
    [
      "the photo edge, holding the other side",
      photo,
      1000,
      {},
      null,
      2,
      [["ArrowRight", 80, false]],
      { height: 1500, width: 4000 },
      [],
    ],
    [
      "the minimum size on both axes",
      photo,
      1000,
      { minSize: { height: 512, width: 512 } },
      null,
      null,
      [
        ["ArrowLeft", 60, true],
        ["ArrowUp", 60, true],
      ],
      { height: 512, width: 512 },
      [],
    ],
    [
      "a crop already under the 88 px floor",
      { height: 2000, width: 2000 },
      400,
      {},
      { size: { height: 0.1, width: 0.5 } },
      null,
      [["ArrowUp", 3, true]],
      {},
      ["height", "width"],
    ],
    [
      "the 88 px floor",
      photo,
      800,
      {},
      null,
      null,
      [["ArrowLeft", 60, true]],
      { height: 3000, screenWidth: 88 },
      [],
    ],
    [
      "the zoom ceiling, holding the other side",
      photo,
      400,
      { maxZoom: 15 },
      { size: { height: 1 / 30, width: 1 / 15 } },
      15,
      [["ArrowLeft", 5, false]],
      {},
      ["height", "width"],
    ],
  ])(
    "stops alt arrows at %s",
    (_name, image, viewport, options, value, zoom, presses, expected, kept) => {
      const context = thinCropper(image, viewport, options);

      context.cropper.setValue(value ?? {});

      if (zoom !== null) {
        context.cropper.setZoom(zoom);
      }

      context.time.frames(2);
      const before = sides(context.cropper);

      for (const [name, times, shift] of presses) {
        keyboard(context)(name, times, shift);
      }

      expect(sides(context.cropper)).toMatchObject({
        ...near(pick(before, kept), 6),
        ...near(expected, 6),
      });
    }
  );
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

const stateRig = () => {
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("Element", Object);

  vi.stubGlobal("document", {
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  const { cropper, time } = photoCropper();
  const view = viewOf(cropper);

  const place = (width: number, height: number): void => {
    view.setLayout({
      dpr: 1,
      height,
      inset: { bottom: 0, left: 0, right: 0, top: 0 },
      width,
    });

    time.frame();
  };

  place(400, 300);
  const handle = handleHandlers(cropper, "bottom-right");

  const dragIn = (): void => {
    handle.onPointerDown(pointerAt(400, 300));
    handle.onPointerMove(pointerAt(250, 200));
    time.frame();
  };

  const letGo = (): void => {
    handle.onPointerUp(pointerAt(250, 200));
  };

  const scaleOf = (): number | undefined => view.frame()?.scale;

  return { cropper, dragIn, letGo, place, scaleOf, time, view };
};

const fitScale = (width: number): number => width / 4000;

const fittedScale = (view: ReturnType<typeof viewOf>): number => {
  const frame = view.frame();

  if (!frame) {
    throw new Error("no frame");
  }

  return fitPlacement(frame.layout, frame.state).scale;
};

describe("a press during a transition", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["a press ends a flip", "flip", "press"],
    ["a press ends a rotate", "rotate90", "press"],
    ["stop ends a flip", "flip", "stop"],
  ] as const)("%s on the resting pose at once", (_, action, how) => {
    const { cropper, time, view } = stateRig();
    const ends = {
      press: () => {
        cropper.begin("pan", undefined, "pan");
        time.frame();
      },
      stop: () => {
        cropper.stop();
      },
    };

    cropper[action]();
    time.frames(4);
    const frames: Box[] = [];

    view.onFrame((frame) => {
      frames.push(frame.rect);
    });

    ends[how]();
    const painted = view.frame()?.matrix ?? [];

    expect(view.chrome().transition).toBeNull();
    expect(frames.length).toBeGreaterThan(0);
    cropper.end(undefined, "pan");
    time.frames(60);
    expect(view.frame()?.matrix).toStrictEqual(painted);
    expect(time.pending()).toBe(0);
    cropper.flip();
    time.frames(120);
    cropper.flip();
    time.frames(120);

    expect(painted.map((v) => Math.round(v * 1e6))).toStrictEqual(
      view.frame()?.matrix.map((v) => Math.round(v * 1e6))
    );
  });
});

describe("stop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns a pinned crop to the fit on the next layout", () => {
    vi.useFakeTimers();
    const { cropper, dragIn, letGo, place, scaleOf, time, view } = stateRig();

    dragIn();
    letGo();
    time.frames(2);
    cropper.stop();
    vi.advanceTimersByTime(5000);
    time.frames(60);
    expect(scaleOf()).toBeCloseTo(fittedScale(view), 9);
    place(800, 600);
    expect(scaleOf()).toBeCloseTo(fittedScale(view), 9);
  });
});

const escapeDrag = () => {
  const escapes: ((event: KeyboardEvent) => void)[] = [];
  const rig = stateRig();

  vi.stubGlobal(
    "addEventListener",
    (type: string, listener: (event: KeyboardEvent) => void) => {
      if (type === "keydown") {
        escapes.push(listener);
      }
    }
  );

  rig.dragIn();

  for (const onEscape of escapes) {
    Reflect.apply(onEscape, undefined, [
      { key: "Escape", preventDefault: () => {}, stopPropagation: () => {} },
    ]);
  }

  return rig;
};

describe("escape on a handle drag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps refitting a crop that was fitted and runs no recentre", () => {
    vi.useFakeTimers();
    const { place, scaleOf, time, view } = escapeDrag();
    const seen: (string | null)[] = [];

    view.onChrome(() => {
      seen.push(view.chrome().transition);
    });

    vi.advanceTimersByTime(5000);
    time.frames(60);
    expect(seen).not.toContain("recenter");
    place(800, 600);
    expect(scaleOf()).toBeCloseTo(fitScale(800), 9);
    place(200, 150);
    expect(scaleOf()).toBeCloseTo(fitScale(200), 9);
  });
});

describe("a recentre that loses its view", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each([
    ["a hidden viewport", "hide"],
    ["a removed photo", "clear"],
  ] as const)("clears the transition on %s", (_, how) => {
    vi.useFakeTimers();
    const { cropper, dragIn, letGo, time, view } = stateRig();

    dragIn();
    letGo();
    vi.advanceTimersByTime(500);
    time.frames(2);
    expect(view.chrome().transition).toBe("recenter");

    if (how === "hide") {
      view.setLayout(null);
    } else {
      cropper.setImage(null);
    }

    time.frames(2);
    expect(view.chrome().transition).toBeNull();
    expect(time.pending()).toBe(0);
  });
});

describe("the frame between two paints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the current crop and starts a transition from the pose on screen", () => {
    const { cropper, time, view } = stateRig();

    cropper.setValue({ size: { height: 0.5, width: 0.5 } });
    expect(view.frame()?.state).toBe(cropper.getCropState());
    expect(view.frame()?.scale).toBeCloseTo(fitScale(800), 9);
    time.frame();
    expect(view.frame()?.scale).toBeCloseTo(fitScale(800), 9);
    const shown = view.frame()?.matrix;

    cropper.flip();
    time.frame(0);
    expect(view.frame()?.matrix[0]).toBeCloseTo(shown?.[0] ?? 0, 6);
  });
});

const TILT = { horizontal: 0, vertical: 10 };
const FLAT = { horizontal: 0, vertical: 0 };

const tiltSetup = () => {
  const { cropper, time } = setup({
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
  const transitions: (string | null)[] = [];

  view.onChrome(() => {
    transitions.push(view.chrome().transition);
  });

  return { cropper, time, transitions, view };
};

describe("view under perspective", () => {
  it.each([
    [
      "a rotate",
      (cropper: Cropper) => {
        cropper.rotate90("cw");
      },
      [],
    ],
    [
      "a flip",
      (cropper: Cropper) => {
        cropper.flip();
      },
      [],
    ],
    [
      "a reset",
      (cropper: Cropper) => {
        cropper.reset();
      },
      [],
    ],
    [
      "an aspect",
      (cropper: Cropper) => {
        cropper.setAspect(1);
      },
      [],
    ],
    [
      "an undo onto a tilt",
      (cropper: Cropper) => {
        cropper.setValue({ perspective: TILT }, { reason: "history" });
      },
      ["morph", null],
    ],
  ])(
    "lands %s on a tilted photo with no transition left on",
    (name, act, expected) => {
      const { cropper, time, transitions, view } = tiltSetup();
      const start = name === "an undo onto a tilt" ? FLAT : TILT;

      cropper.setValue({ perspective: start });
      time.frames(2);
      const tilted = view.frame()?.matrix ?? [];

      expect(tilted[6] !== 0 || tilted[7] !== 0).toBe(start === TILT);

      const frames: number[][] = [];

      view.onFrame((frame) => {
        frames.push([...frame.matrix]);
      });

      act(cropper);
      time.frames(120);
      expect(transitions).toStrictEqual(expected);
      expect(time.pending()).toBe(0);
      const end = view.frame()?.matrix ?? [];

      expect(frames.length).toBeGreaterThan(0);

      for (const matrix of frames) {
        for (const [i, value] of matrix.entries()) {
          expect(value).toBeCloseTo(end[i] ?? 0, 9);
        }
      }

      view.destroy();
    }
  );

  it("ends a running recentre when a rotate starts from a tilted photo", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { cropper, time, view } = tiltSetup();

    cropper.setValue({ perspective: TILT });
    time.frames(2);
    cropper.begin("resize", undefined, "handle");
    view.hold();
    cropper.setZoom(2);
    time.frames(2);
    view.release();
    cropper.end(undefined, "handle");
    time.frames(2);
    vi.advanceTimersByTime(500);
    time.frames(3);
    expect(view.chrome().transition).toBe("recenter");
    cropper.rotate90("cw");
    time.frame();
    const fit = view.frame()?.rect;

    expect(view.chrome().transition).toBeNull();
    time.frame();
    expect(view.frame()?.rect).toStrictEqual(fit);
    vi.useRealTimers();
    view.destroy();
  });
});

const angleOf = (frame: ViewFrame | undefined): number =>
  frame ? Math.atan2(frame.matrix[3], frame.matrix[0]) : Number.NaN;

describe("quarter turns and flips", () => {
  const QUARTER_PHOTO = { height: 1200, width: 1600 };
  const QUARTER_LAYOUT: Layout = {
    dpr: 1,
    height: 480,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 640,
  };
  const CORNER = {
    center: { x: 0.2525, y: 0.733 },
    quarterTurns: 1,
    size: { height: 0.505, width: 0.505 },
  } as const;

  const rig = (options: CropperOptions = {}) => {
    const { cropper, time } = setup({
      image: QUARTER_PHOTO,
      ...options,
    });
    const view = viewOf(cropper);

    view.setLayout(QUARTER_LAYOUT);
    view.setOptions({ motion: "always" });
    time.frame();
    const frames: ViewFrame[] = [];

    view.onFrame((frame) => {
      frames.push(frame);
    });

    return { cropper, frames, time, view };
  };

  it("rotate from a crop in a corner turns the photo a quarter", () => {
    const { cropper, frames, time, view } = rig({ defaultValue: CORNER });
    const before = view.frame();

    cropper.rotate90("cw", { reason: "rotate-90" });
    time.frames(40);
    const turned =
      angleOf(frames.at(-1) ?? frames[0]) - angleOf(before ?? frames[0]);
    const quarter = Math.abs(Math.atan2(Math.sin(turned), Math.cos(turned)));

    expect(frames.length).toBeGreaterThan(10);
    expect(quarter).toBeCloseTo(Math.PI / 2, 3);
  });

  it.each([
    [
      "undo across a quarter turn",
      (c: Cropper) => {
        c.setValue(
          {
            center: { x: 0.733, y: 0.7475 },
            size: { height: 0.505, width: 0.505 },
          },
          { emit: false }
        );

        c.rotate90("cw", { emit: false });

        c.setValue(
          {
            center: { x: 0.733, y: 0.7475 },
            quarterTurns: 0,
            size: { height: 0.505, width: 0.505 },
          },
          { emit: false }
        );
      },
      (c: Cropper) => {
        c.setValue(CORNER, { reason: "history" });
      },
      "rotate",
    ],
    [
      "reset across a quarter turn",
      (c: Cropper) => {
        c.setValue(
          {
            center: { x: 0.733, y: 0.7475 },
            size: { height: 0.505, width: 0.505 },
          },
          { emit: false }
        );

        c.rotate90("cw", { emit: false });
      },
      (c: Cropper) => {
        c.reset({ reason: "reset" });
      },
      "rotate",
    ],
    [
      "reset from a straightened crop",
      (c: Cropper) => {
        c.setRotation(45, { emit: false });
      },
      (c: Cropper) => {
        c.reset({ reason: "reset" });
      },
      "morph",
    ],
    [
      "flip after a quarter turn",
      (c: Cropper) => {
        c.rotate90("cw", { emit: false });
      },
      (c: Cropper) => {
        c.flip("x", { reason: "flip" });
      },
      "flip",
    ],
  ])("runs %s as one transition", (_, prepare, act, transition) => {
    const { cropper, frames, time, view } = rig();

    prepare(cropper);
    time.frames(2);
    frames.length = 0;
    const seen: (string | null)[] = [];

    view.onChrome(() => {
      seen.push(view.chrome().transition);
    });

    act(cropper);
    time.frames(50);

    expect(seen[0]).toBe(transition);
    expect(frames.length).toBeGreaterThan(5);
  });
});

const spin = (
  direction: "ccw" | "cw",
  gap: number,
  presses: number,
  mirrored = false
) => {
  const { cropper, time } = setup({
    defaultValue: { mirrored },
    image: { height: 3000, width: 4000 },
  });
  const view = viewOf(cropper);

  view.setLayout({
    dpr: 1,
    height: 300,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 400,
  });

  view.setOptions({ motion: "always" });
  time.frame();
  const angles: number[] = [];
  let last: number | null = null;
  let total = 0;

  view.onFrame((frame) => {
    const now = Math.atan2(-frame.matrix[1], frame.matrix[4]);

    if (last !== null) {
      let step = now - last;

      step -= 2 * Math.PI * Math.round(step / (2 * Math.PI));
      total += step;
    }

    last = now;
    angles.push(total);
  });

  for (let i = 0; i < presses; i += 1) {
    cropper.rotate90(direction, { reason: "rotate-90" });
    time.frames(gap);
  }

  time.frames(40);

  return angles;
};

describe("a running turn", () => {
  it.each([
    ["ccw", -1, 0, 2],
    ["ccw", -1, 2, 4],
    ["cw", 1, 0, 2],
    ["cw", 1, 2, 4],
  ] as const)(
    "%s turns spin one way (sign %i) with presses %i frames apart, %i presses",
    (name, sign, gap, presses) => {
      const angles = spin(name, gap, presses);

      for (const [i, angle] of angles.entries()) {
        expect(sign * (angle - (angles[i - 1] ?? 0))).toBeGreaterThan(-1e-9);
      }

      expect(sign * (angles.at(-1) ?? 0)).toBeCloseTo(
        (presses * Math.PI) / 2,
        3
      );
    }
  );

  it("a mirrored photo still turns the way the button says", () => {
    const angles = spin("ccw", 4, 2, true);

    expect(angles.at(-1)).toBeCloseTo(-Math.PI, 3);
  });
});

const turning = (motion: "always" | "reduce" = "always") => {
  const rig = laidOut({ image: PHOTO });

  rig.view.setOptions({ motion });
  rig.time.frames(2);

  return rig;
};

const spinSteps = (angles: number[]): number[] =>
  angles.slice(1).map((angle, index) => {
    const turn = angle - (angles[index] ?? 0);

    return (
      ((turn - 2 * Math.PI * Math.round(turn / (2 * Math.PI))) * 180) / Math.PI
    );
  });

const isLayer = (value: unknown): value is HTMLElement => isObject(value);

const styleOf = () => {
  const written = new Map<string, string>();
  const style = {
    clipPath: "",
    removeProperty(name: string): void {
      written.delete(name);
    },
    setProperty(name: string, value: string): void {
      written.set(name, value);
    },
  };

  return {
    element: cast({ style, toggleAttribute: () => false }, isLayer),
    style,
    written,
  };
};

describe("view transitions", () => {
  it.each([
    ["always", 300, 480],
    ["reduce", 120, 200],
  ] as const)(
    "turns a quarter under motion %s in about the documented time, with one change and one commit",
    (motion, shortest, longest) => {
      const { change, commit, cropper, time, view } = turning(motion);
      const seen = new Set<string>();
      const off = view.onFrame((frame) => {
        seen.add(Math.atan2(frame.matrix[3], frame.matrix[0]).toFixed(2));
      });

      cropper.rotate90();
      time.frames(2);
      expect(view.chrome().transition).toBe("rotate");
      let frames = 2;

      while (view.chrome().transition === "rotate" && frames < 120) {
        time.frame();
        frames += 1;
      }

      off();
      const ms = frames * (1000 / 60);

      expect({
        changes: change.mock.calls.length,
        commits: commit.mock.calls.length,
        inTime: ms >= shortest && ms <= longest,
        moving: seen.size > 5,
        transition: view.chrome().transition,
      }).toStrictEqual({
        changes: 1,
        commits: 1,
        inTime: true,
        moving: true,
        transition: null,
      });
    }
  );

  it.each([
    ["a rect mask", undefined, "evenodd", true],
    ["a circle mask", "circle", "polygon(", false],
  ] as const)(
    "keeps the photo whole and %s around the crop through a quarter turn",
    (_, shape, marker, present) => {
      const { cropper, time, view } = turning();
      const image = styleOf();
      const mask = styleOf();

      cropper.setAspect(1, { emit: false });
      time.frames(40);
      const off = [
        bindImage(cropper, image.element),
        bindMask(cropper, mask.element, shape),
      ];

      cropper.rotate90("cw", { reason: "rotate-90" });
      time.frames(6);
      expect(view.chrome().transition).toBe("rotate");
      expect(image.style.clipPath).toBe("");
      const drawn =
        mask.style.clipPath + (mask.written.get("mask-image") ?? "");

      expect([drawn === "", drawn.includes(marker)]).toStrictEqual([
        false,
        present,
      ]);

      for (const stop of off) {
        stop();
      }
    }
  );

  it("morphs the crop to a new aspect through the sizes between", () => {
    const { cropper, time, view } = turning();
    const widths: number[] = [];
    const off = view.onFrame((frame) => {
      widths.push(frame.rect.width);
    });

    cropper.setAspect(1);
    time.frames(42);
    off();
    const start = widths[0] ?? 0;
    const end = view.frame()?.rect;

    expect(end?.width).toBeCloseTo(end?.height ?? 0, 0);

    expect(
      widths.some((w) => w < start - 10 && w > (end?.width ?? 0) + 10)
    ).toBeTruthy();

    expect(view.chrome().transition).toBeNull();
  });

  it.each<
    [string, (cropper: Cropper) => void, (m: number[]) => number, number]
  >([
    [
      "an aspect change",
      (cropper) => {
        cropper.setAspect(1);
      },
      (m) => Math.atan2(m[3] ?? 0, m[0] ?? 0),
      -270,
    ],
    [
      "a flip",
      (cropper) => {
        cropper.flip();
      },
      (m) => Math.atan2(m[3] ?? 0, m[4] ?? 0),
      -270,
    ],
  ])(
    "keeps spinning the same way when %s lands mid spin",
    (_, write, angle, total) => {
      const { cropper, time, view } = turning();
      const angles: number[] = [];
      const off = view.onFrame((frame) => {
        angles.push(angle(frame.matrix));
      });

      for (let tap = 0; tap < 3; tap += 1) {
        cropper.rotate90("ccw", { reason: "rotate-90" });
        time.frames(1);
      }

      write(cropper);
      time.frames(40);
      off();
      const steps = spinSteps(angles);

      expect(Math.max(...steps)).toBeLessThan(0.01);
      expect(steps.reduce((sum, step) => sum + step, 0)).toBeCloseTo(total, 0);
    }
  );

  it("takes the short way when a reset changes the target angle mid spin", () => {
    const { cropper, time, view } = turning();
    const angles: number[] = [];
    const off = view.onFrame((frame) => {
      angles.push(Math.atan2(frame.matrix[3], frame.matrix[0]));
    });

    cropper.rotate90("ccw", { reason: "rotate-90" });
    time.frames(3);
    cropper.reset();
    time.frames(40);
    off();

    expect(spinSteps(angles).reduce((sum, step) => sum + step, 0)).toBeCloseTo(
      0,
      0
    );
  });
});
