import type { Cropper } from "../cropper";
import {
  applyHomography,
  invertMatrix3,
  multiplyMatrix3,
} from "../geometry/matrix";
import {
  isFlatPerspective,
  perspectiveHomography,
} from "../geometry/perspective";
import { linearTransform } from "../geometry/state";
import type { CropState, Matrix3, Point, Size } from "../geometry/types";
import { spring } from "../motion";
import { claim, claimed } from "./input";

export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  width: number;
  height: number;
  inset: Inset;
  dpr: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement {
  scale: number;
  offset: Point;
}

export interface ViewFrame {
  rect: Box;
  matrix: Matrix3;
  scale: number;
  state: CropState;
  layout: Layout;
}

export type Transition = "recentre" | "rotate" | "flip" | "morph";

export type Grid = "none" | "coarse" | "fine";

export interface Chrome {
  grid: Grid;
  active: boolean;
  transition: Transition | null;
  overscroll: boolean;
}

export interface ViewOptions {
  motion?: "auto" | "always" | "reduce" | undefined;
  recentreDelay?: number | undefined;
}

export interface View {
  frame: () => ViewFrame | null;
  chrome: () => Chrome;
  onChrome: (listener: () => void) => () => void;
  setOptions: (options: ViewOptions) => void;
  reducedMotion: () => boolean;
  local: (event: { clientX: number; clientY: number }) => Point;
  claim: (event: Event) => void;
  claimed: (event: Event) => boolean;
  setLayout: (layout: Layout | null, surface?: HTMLElement) => void;
  hold: () => Placement | null;
  release: () => void;
  setOverscroll: (offset: Point | null, zoom?: number, anchor?: Point) => void;
  overscroll: () => Point;
  overzoom: () => number;
  settleOverscroll: (quick?: boolean) => void;
  onFrame: (listener: (frame: ViewFrame) => void) => () => void;
  onEmpty: (listener: () => void) => () => void;
  destroy: () => void;
}

export const LAYER_BOX: Record<string, string> = {
  border: "0",
  left: "0",
  margin: "0",
  maxHeight: "none",
  maxWidth: "none",
  minHeight: "0",
  minWidth: "0",
  padding: "0",
  position: "absolute",
  top: "0",
};

export const snap = (value: number, dpr: number): number =>
  Math.round(value * dpr) / dpr;

export const fitPlacement = (layout: Layout, state: CropState): Placement => {
  const { inset } = layout;
  const width = Math.max(layout.width - inset.left - inset.right, 1);
  const height = Math.max(layout.height - inset.top - inset.bottom, 1);
  const scale = Math.min(width / state.crop.width, height / state.crop.height);
  return {
    offset: {
      x: inset.left + width / 2 - scale * state.crop.x,
      y: inset.top + height / 2 - scale * state.crop.y,
    },
    scale,
  };
};

const NO_SHIFT: Point = { x: 0, y: 0 };

export const imageMatrix = (
  state: CropState,
  placement: Placement,
  shift: Point = NO_SHIFT
): Matrix3 => {
  const [l00, l01, l10, l11] = linearTransform(state);
  const k = placement.scale;
  const affine: Matrix3 = [
    k * l00,
    k * l01,
    placement.offset.x + shift.x,
    k * l10,
    k * l11,
    placement.offset.y + shift.y,
    0,
    0,
    1,
  ];
  const centre: Matrix3 = [
    1,
    0,
    -state.image.width / 2,
    0,
    1,
    -state.image.height / 2,
    0,
    0,
    1,
  ];
  const keystone = isFlatPerspective(state.perspective)
    ? centre
    : multiplyMatrix3(perspectiveHomography(state.perspective), centre);
  return multiplyMatrix3(affine, keystone);
};

export const cssMatrix = (m: Matrix3): string => {
  if (m[6] === 0 && m[7] === 0 && m[8] === 1) {
    return `matrix(${m[0]},${m[3]},${m[1]},${m[4]},${m[2]},${m[5]})`;
  }
  return `matrix3d(${m[0]},${m[3]},0,${m[6]},${m[1]},${m[4]},0,${m[7]},0,0,1,0,${m[2]},${m[5]},0,${m[8]})`;
};

const share = (seen: number, own: number): number =>
  own > 0 && seen > 0 && Math.abs(seen - own) >= 1 ? seen / own : 1;

export const isHtml = (element: Element): element is HTMLElement =>
  "offsetWidth" in element;

const scaleOf = (element: Element, box: DOMRect): Point =>
  isHtml(element)
    ? {
        x: share(box.width, element.offsetWidth),
        y: share(box.height, element.offsetHeight),
      }
    : { x: 1, y: 1 };

export const visualScale = (element: Element): Point =>
  scaleOf(element, element.getBoundingClientRect());

export const localOf = (
  element: Element
): ((event: { clientX: number; clientY: number }) => Point) => {
  const box = element.getBoundingClientRect();
  const scale = scaleOf(element, box);
  return (event) => ({
    x: (event.clientX - box.left) / scale.x - element.clientLeft,
    y: (event.clientY - box.top) / scale.y - element.clientTop,
  });
};

const views = new WeakMap<Cropper, View>();

const OVERSCROLL_OMEGA = 42;
const OVERSCROLL_ZETA = 1.4;
const TEMPO = 1.35;
const ZOOM_OMEGA = 17.3 * TEMPO;
const RECENTRE_OMEGA = 16.1 * TEMPO;
const RECENTRE_DELAY = 500;
const CHROME_HOLD = 1380;
const ROTATE_MS = 410 / TEMPO;
const FLIP_OMEGA = 17.6 * TEMPO;
const REDUCED_MS = 150;
const REDUCED_OMEGA = 40;

interface Pose {
  rect: Box;
  centre: Point;
  anchor: Point;
  angle: number;
  mirror: number;
  sx: number;
  sy: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpBox = (a: Box, b: Box, t: number): Box => ({
  height: lerp(a.height, b.height, t),
  width: lerp(a.width, b.width, t),
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});

const snapBox = (box: Box, dpr: number): Box => {
  const x0 = Math.ceil(box.x * dpr - 1e-6) / dpr;
  const y0 = Math.ceil(box.y * dpr - 1e-6) / dpr;
  const x1 = Math.max(Math.floor((box.x + box.width) * dpr + 1e-6) / dpr, x0);
  const y1 = Math.max(Math.floor((box.y + box.height) * dpr + 1e-6) / dpr, y0);
  return { height: y1 - y0, width: x1 - x0, x: x0, y: y0 };
};

const exactBox = (state: CropState, placement: Placement): Box => ({
  height: placement.scale * state.crop.height,
  width: placement.scale * state.crop.width,
  x:
    placement.offset.x +
    placement.scale * (state.crop.x - state.crop.width / 2),
  y:
    placement.offset.y +
    placement.scale * (state.crop.y - state.crop.height / 2),
});

const pinnedPlacement = (rect: Box, state: CropState): Placement => {
  const scale = rect.width / state.crop.width;
  return {
    offset: {
      x: rect.x + rect.width / 2 - scale * state.crop.x,
      y: rect.y + rect.height / 2 - scale * state.crop.y,
    },
    scale,
  };
};

const pose = (rect: Box, matrix: Matrix3): Pose | null => {
  if (matrix[6] !== 0 || matrix[7] !== 0) {
    return null;
  }
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const [a, b, , c, d] = matrix;
  const det = a * d - b * c;
  const mirror = det < 0 ? -1 : 1;
  const sx = Math.hypot(a, c);
  return {
    anchor: applyHomography(invertMatrix3(matrix), centre),
    angle: Math.atan2(c, mirror * a),
    centre,
    mirror,
    rect,
    sx,
    sy: (mirror * det) / sx,
  };
};

const blendPose = (from: Pose, to: Pose, t: number): Pose => {
  let turn = to.angle - from.angle;
  turn -= 2 * Math.PI * Math.round(turn / (2 * Math.PI));
  return {
    anchor: {
      x: lerp(from.anchor.x, to.anchor.x, t),
      y: lerp(from.anchor.y, to.anchor.y, t),
    },
    angle: from.angle + turn * t,
    centre: {
      x: lerp(from.centre.x, to.centre.x, t),
      y: lerp(from.centre.y, to.centre.y, t),
    },
    mirror: lerp(from.mirror, to.mirror, t),
    rect: lerpBox(from.rect, to.rect, t),
    sx: lerp(from.sx, to.sx, t),
    sy: lerp(from.sy, to.sy, t),
  };
};

const poseMatrix = ({
  anchor,
  angle,
  centre,
  mirror,
  sx,
  sy,
}: Pose): Matrix3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const a = mirror * sx * cos;
  const b = -mirror * sy * sin;
  const c = sx * sin;
  const d = sy * cos;
  return [
    a,
    b,
    centre.x - a * anchor.x - b * anchor.y,
    c,
    d,
    centre.y - c * anchor.x - d * anchor.y,
    0,
    0,
    1,
  ];
};

const subscribe =
  <T>(set: Set<T>) =>
  (listener: T): (() => void) => {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };

const easeOut = (t: number): number => 1 - (1 - t) ** 3;

const settled = (omega: number, ms: number): number => {
  const t = (omega * ms) / 1000;
  return 1 - (1 + t) * Math.exp(-t);
};

export const viewOf = (cropper: Cropper): View => {
  const existing = views.get(cropper);
  if (existing) {
    return existing;
  }
  let options: ViewOptions = {};
  let layout: Layout | null = null;
  let held: Placement | null = null;
  let pinned: Box | null = null;
  let shift: Point = { x: 0, y: 0 };
  let zoom = 1;
  let anchor: Point = { x: 0, y: 0 };
  let stopShift: (() => void) | null = null;
  let stopZoom: (() => void) | null = null;
  let stopTransition: (() => void) | null = null;
  let recentreTimer: ReturnType<typeof setTimeout> | null = null;
  let chromeTimer: ReturnType<typeof setTimeout> | null = null;
  let blend: { from: Pose; t: number } | null = null;
  let shown: Pose | null = null;
  let chrome: Chrome = {
    active: false,
    grid: "none",
    overscroll: false,
    transition: null,
  };
  let last: ViewFrame | null = null;
  let target: HTMLElement | undefined;
  const surfaces = new Map<HTMLElement | undefined, Layout>();
  let photo: Size | undefined;
  const listeners = new Set<(frame: ViewFrame) => void>();
  const chromeListeners = new Set<() => void>();
  const emptyListeners = new Set<() => void>();
  let empty = false;
  const reduceQuery =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  const reduced = (): boolean =>
    options.motion === "reduce" ||
    (options.motion !== "always" && (reduceQuery?.matches ?? false));

  const notifyChrome = (): void => {
    for (const listener of chromeListeners) {
      listener();
    }
  };

  const setChrome = (next: Partial<Chrome>): void => {
    const merged = { ...chrome, ...next };
    if (
      merged.active === chrome.active &&
      merged.grid === chrome.grid &&
      merged.overscroll === chrome.overscroll &&
      merged.transition === chrome.transition
    ) {
      return;
    }
    chrome = merged;
    notifyChrome();
  };

  const placementOf = (state: CropState, current: Layout): Placement => {
    if (held) {
      return held;
    }
    return pinned
      ? pinnedPlacement(pinned, state)
      : fitPlacement(current, state);
  };

  const endTransition = (): void => {
    stopTransition?.();
    stopTransition = null;
    blend = null;
    setChrome({ transition: null });
  };

  const followPhoto = (): void => {
    const size = cropper.getCropState()?.image;
    if (
      photo &&
      size &&
      (photo.width !== size.width || photo.height !== size.height)
    ) {
      held = null;
      pinned = null;
      last = null;
      endTransition();
      if (recentreTimer !== null) {
        clearTimeout(recentreTimer);
        recentreTimer = null;
      }
    }
    photo = size ?? photo;
  };

  const compute = (): ViewFrame | null => {
    followPhoto();
    const state = cropper.getCropState();
    if (!layout || !state) {
      return null;
    }
    const placement = placementOf(state, layout);
    const matrix = imageMatrix(
      state,
      zoom === 1
        ? placement
        : {
            offset: {
              x: anchor.x + zoom * (placement.offset.x - anchor.x),
              y: anchor.y + zoom * (placement.offset.y - anchor.y),
            },
            scale: zoom * placement.scale,
          },
      shift
    );
    const exact = exactBox(state, placement);
    if (blend) {
      const to = pose(exact, matrix);
      if (to) {
        shown = blendPose(blend.from, to, blend.t);
        return {
          layout,
          matrix: poseMatrix(shown),
          rect: snapBox(shown.rect, layout.dpr),
          scale: placement.scale,
          state,
        };
      }
    }
    return {
      layout,
      matrix,
      rect: snapBox(exact, layout.dpr),
      scale: placement.scale,
      state,
    };
  };

  const publish = (): void => {
    last = compute();
    if (last) {
      for (const listener of listeners) {
        listener(last);
      }
    }
    const gone = !cropper.getCropState();
    if (gone && !empty) {
      for (const listener of emptyListeners) {
        listener();
      }
    }
    empty = gone;
  };

  const recentre = (): void => {
    recentreTimer = null;
    const from = pinned;
    if (!from) {
      return;
    }
    const omega = reduced() ? REDUCED_OMEGA : RECENTRE_OMEGA;
    let elapsed = 0;
    setChrome({ transition: "recentre" });
    stopTransition = cropper.run((_, delta) => {
      elapsed += delta;
      const state = cropper.getCropState();
      if (!layout || !state) {
        pinned = null;
        stopTransition = null;
        setChrome({ transition: null });
        return false;
      }
      const fit = exactBox(state, fitPlacement(layout, state));
      const t = settled(omega, elapsed);
      if (t > 0.9995) {
        pinned = null;
        stopTransition = null;
        setChrome({ transition: null });
        return false;
      }
      pinned = lerpBox(from, fit, t);
      return true;
    }, false);
  };

  const scheduleRecentre = (): void => {
    if (recentreTimer !== null) {
      clearTimeout(recentreTimer);
    }
    recentreTimer = pinned
      ? setTimeout(recentre, options.recentreDelay ?? RECENTRE_DELAY)
      : null;
  };

  const animate = (kind: Transition, from: ViewFrame): void => {
    const start = (blend && shown) ?? pose(from.rect, from.matrix);
    endTransition();
    if (!start) {
      return;
    }
    blend = { from: start, t: 0 };
    setChrome({ transition: kind });
    let elapsed = 0;
    const quick = reduced();
    stopTransition = cropper.run((_, delta) => {
      elapsed += delta;
      let t = 1;
      if (quick) {
        t = easeOut(Math.min(elapsed / REDUCED_MS, 1));
      } else if (kind === "rotate") {
        t = easeOut(Math.min(elapsed / ROTATE_MS, 1));
      } else if (kind === "flip") {
        t = settled(FLIP_OMEGA, elapsed);
      } else {
        t = settled(RECENTRE_OMEGA, elapsed);
      }
      if (t >= 0.9995 || !blend) {
        blend = null;
        stopTransition = null;
        setChrome({ transition: null });
        return false;
      }
      blend.t = t;
      return true;
    }, false);
  };

  const transitionFor: Partial<Record<string, Transition>> = {
    aspect: "morph",
    flip: "flip",
    history: "morph",
    orientation: "morph",
    reset: "morph",
    "rotate-90": "rotate",
  };

  const markOverscroll = (): void => {
    setChrome({ overscroll: shift.x !== 0 || shift.y !== 0 || zoom !== 1 });
  };

  const settleShift = (): void => {
    stopShift?.();
    stopShift = null;
    const from = shift;
    if (from.x === 0 && from.y === 0) {
      return;
    }
    let elapsed = 0;
    stopShift = cropper.run((_, delta) => {
      elapsed += delta;
      const x = spring(from.x, 0, OVERSCROLL_OMEGA, OVERSCROLL_ZETA, elapsed);
      const y = spring(from.y, 0, OVERSCROLL_OMEGA, OVERSCROLL_ZETA, elapsed);
      const done =
        Math.abs(x.value) < 0.1 &&
        Math.abs(y.value) < 0.1 &&
        Math.abs(x.velocity) < 1 &&
        Math.abs(y.velocity) < 1;
      shift = done ? { x: 0, y: 0 } : { x: x.value, y: y.value };
      if (done) {
        stopShift = null;
        markOverscroll();
      }
      return !done;
    }, false);
  };

  const settleZoom = (quick: boolean): void => {
    stopZoom?.();
    stopZoom = null;
    const from = Math.log(zoom);
    if (from === 0) {
      return;
    }
    let elapsed = 0;
    stopZoom = cropper.run((_, delta) => {
      elapsed += delta;
      const z = quick
        ? spring(from, 0, OVERSCROLL_OMEGA, OVERSCROLL_ZETA, elapsed)
        : spring(from, 0, ZOOM_OMEGA, 1, elapsed);
      const done = Math.abs(z.value) < 1e-4 && Math.abs(z.velocity) < 1e-2;
      zoom = done ? 1 : Math.exp(z.value);
      if (done) {
        stopZoom = null;
        markOverscroll();
      }
      return !done;
    }, false);
  };

  const clearTimers = (): void => {
    if (recentreTimer !== null) {
      clearTimeout(recentreTimer);
      recentreTimer = null;
    }
    if (chromeTimer !== null) {
      clearTimeout(chromeTimer);
      chromeTimer = null;
    }
  };

  const offFrame = cropper.on("frame", publish);
  const offChange = cropper.on("accept", (_, details) => {
    const kind = transitionFor[details.reason];
    const from = last;
    if (kind && from) {
      pinned = null;
      animate(kind, from);
    }
  });
  const offStart = cropper.on("gesturestart", (reason) => {
    const moving = blend;
    clearTimers();
    endTransition();
    const grids: Partial<Record<string, Grid>> = {
      dial: "fine",
      keyboard: chrome.grid,
    };
    setChrome({ active: true, grid: grids[reason] ?? "coarse" });
    if (moving) {
      publish();
    }
  });
  const offStop = cropper.on("stop", () => {
    endTransition();
    held = null;
    pinned = null;
    stopShift?.();
    stopShift = null;
    stopZoom?.();
    stopZoom = null;
    shift = { x: 0, y: 0 };
    zoom = 1;
    markOverscroll();
    clearTimers();
    setChrome({ active: false, grid: "none" });
  });
  const offEnd = cropper.on("gestureend", () => {
    if (chrome.grid === "fine") {
      setChrome({ grid: "none" });
    }
    chromeTimer = setTimeout(() => {
      chromeTimer = null;
      setChrome({ active: false, grid: "none" });
    }, CHROME_HOLD);
    scheduleRecentre();
  });

  const view: View = {
    chrome: () => chrome,
    claim,
    claimed,
    destroy() {
      offFrame();
      offChange();
      offStart();
      offEnd();
      offStop();
      stopShift?.();
      stopZoom?.();
      endTransition();
      clearTimers();
      listeners.clear();
      chromeListeners.clear();
      emptyListeners.clear();
      views.delete(cropper);
    },
    frame() {
      followPhoto();
      return last?.state === cropper.getCropState() ? last : compute();
    },
    hold() {
      followPhoto();
      const state = cropper.getCropState();
      if (!layout || !state) {
        return null;
      }
      held ??= placementOf(state, layout);
      return held;
    },
    local(event) {
      return target
        ? localOf(target)(event)
        : { x: event.clientX, y: event.clientY };
    },
    onChrome(listener) {
      if (chromeListeners.size === 0) {
        reduceQuery?.addEventListener("change", notifyChrome);
      }
      chromeListeners.add(listener);
      return () => {
        chromeListeners.delete(listener);
        if (chromeListeners.size === 0) {
          reduceQuery?.removeEventListener("change", notifyChrome);
        }
      };
    },
    onEmpty: subscribe(emptyListeners),
    onFrame: subscribe(listeners),
    overscroll: () => shift,
    overzoom: () => zoom,
    reducedMotion: reduced,
    release() {
      followPhoto();
      const state = cropper.getCropState();
      if (held && state && layout && cropper.getState().interacting) {
        const box = exactBox(state, held);
        const fit = exactBox(state, fitPlacement(layout, state));
        pinned =
          Math.abs(box.x - fit.x) +
            Math.abs(box.y - fit.y) +
            Math.abs(box.width - fit.width) +
            Math.abs(box.height - fit.height) <
          1e-6
            ? null
            : box;
      }
      held = null;
      cropper.invalidate();
    },
    setLayout(next, surface) {
      if (next) {
        surfaces.set(surface, next);
      } else {
        surfaces.delete(surface);
      }
      const top = [...surfaces].at(-1);
      target = top?.[0];
      layout = top?.[1] ?? null;
      last = compute();
      cropper.invalidate();
    },
    setOptions(next) {
      const before = reduced();
      options = next;
      if (reduced() !== before) {
        notifyChrome();
      }
    },
    setOverscroll(offset, scale, around) {
      if (offset) {
        stopShift?.();
        stopShift = null;
        shift = offset;
      }
      if (scale !== undefined) {
        stopZoom?.();
        stopZoom = null;
        zoom = scale;
        anchor = around ?? anchor;
      }
      markOverscroll();
      cropper.invalidate();
    },
    settleOverscroll(quick = false) {
      settleShift();
      settleZoom(quick);
    },
  };
  views.set(cropper, view);
  cropper.on("destroy", () => {
    view.destroy();
  });
  return view;
};
