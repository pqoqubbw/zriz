import type { Cropper, CropperInternals } from "../cropper";
import { dragHandle, pairRect } from "../geometry/constraints";
import type { CropHandle, DragLimits } from "../geometry/constraints";
import { imagePlanes } from "../geometry/planes";
import type {
  Crop,
  CropState,
  HalfPlane,
  Point,
  Rect,
} from "../geometry/types";
import { holdCursor } from "./cursor";
import {
  MIN_HANDLE_SPAN,
  bindPointers,
  capture,
  claim,
  claimTouch,
  pressLost,
  presses,
  stopAtZoomCeiling,
  targetOf,
  watchEscape,
  watchLoss,
} from "./input";
import type { PointerHandlers } from "./input";
import { cropShapeOf, setCropShape } from "./shape";
import { followDisabled } from "./slider";
import {
  LAYER_BOX,
  cssMatrix,
  followFlight,
  stateAttributes,
  viewOf,
} from "./view";
import type { Box, Layout, Placement, ViewFrame } from "./view";

type MaskShape = "rect" | "circle";

type HandleEdge =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

type AreaOptions = {
  liveVariables?: boolean | undefined;
  shape?: MaskShape | undefined;
};

type HandleHandlers = PointerHandlers & { release: () => void };

type Finger = {
  at: Point;
  drop: () => void;
  grab: Point | null;
  handle: CropHandle;
};

type ResizeBase = {
  bounds: HalfPlane[];
  placement: Placement;
  start: Rect;
};

type Batch = {
  at: Map<Finger, Point>;
  moved: Set<Finger>;
  rect: Rect;
  time: number;
};

type Resizer = {
  cancel: (event: KeyboardEvent) => void;
  join: (
    event: PointerEvent,
    handle: CropHandle,
    state: CropState,
    drop: () => void
  ) => boolean;
  leave: (id: number, event?: Event) => void;
  move: (event: PointerEvent) => void;
};

const EDGES: Record<HandleEdge, CropHandle> = {
  bottom: "s",
  "bottom-left": "sw",
  "bottom-right": "se",
  left: "w",
  right: "e",
  top: "n",
  "top-left": "nw",
  "top-right": "ne",
};

let shapeSupport: boolean | null = null;

const supportsShape = (): boolean => {
  shapeSupport ??=
    typeof CSS !== "undefined" &&
    CSS.supports(
      "clip-path",
      "shape(evenodd from 0 0, hline to 10px, vline to 10px, close, move to 5px 0, arc by 0 10px of 5px 5px, close)"
    );

  return shapeSupport;
};

const px = (value: number): string => `${value}px`;

const maskClip = (rect: Box, shape: MaskShape): string => {
  const x0 = px(rect.x);
  const y0 = px(rect.y);

  if (shape === "circle") {
    const rx = px(rect.width / 2);
    const ry = px(rect.height / 2);

    return `shape(evenodd from 0 0, hline to 100%, vline to 100%, hline to 0, close, move to ${px(rect.x + rect.width / 2)} ${y0}, arc by 0 ${px(rect.height)} of ${rx} ${ry}, arc by 0 ${px(-rect.height)} of ${rx} ${ry}, close)`;
  }

  const x1 = px(rect.x + rect.width);
  const y1 = px(rect.y + rect.height);

  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x0} ${y0}, ${x1} ${y0}, ${x1} ${y1}, ${x0} ${y1}, ${x0} ${y0})`;
};

const maskGradient = (rect: Box, dpr: number): string => {
  const ramp = 0.5 / dpr;

  return `radial-gradient(${px(rect.width / 2)} ${px(rect.height / 2)} at ${px(rect.x + rect.width / 2)} ${px(rect.y + rect.height / 2)}, transparent calc(100% - ${ramp}px), #000 calc(100% + ${ramp}px))`;
};

const follow = (
  cropper: Cropper,
  write: (frame: ViewFrame) => void
): (() => void) => {
  const view = viewOf(cropper);
  const current = view.frame();

  if (current) {
    write(current);
  }

  return view.onFrame(write);
};

const bindImage = (cropper: Cropper, element: HTMLElement): (() => void) => {
  const { style } = element;

  Object.assign(style, LAYER_BOX);
  style.transformOrigin = "0 0";
  style.pointerEvents = "none";
  style.setProperty("-webkit-user-drag", "none");

  if ("naturalWidth" in element) {
    element.draggable = false;
  }

  let transform = "";
  let width = 0;
  let height = 0;
  const stop = follow(cropper, (frame) => {
    const { image } = frame.state;

    if (image.width !== width || image.height !== height) {
      ({ width, height } = image);
      style.width = px(width);
      style.height = px(height);
    }

    const next = cssMatrix(frame.matrix);

    if (next !== transform) {
      transform = next;
      style.transform = next;
    }
  });
  let moving = false;

  const sync = (): void => {
    const { interacting, settling } = cropper.getState();
    const next = interacting !== null || settling;

    if (next !== moving) {
      moving = next;
      style.willChange = next ? "transform" : "";
    }
  };

  sync();
  const offState = cropper.subscribe(sync);
  const offFlight = followFlight(viewOf(cropper), element);

  return () => {
    stop();
    offState();
    offFlight();
  };
};

const bindMask = (
  cropper: Cropper,
  element: HTMLElement,
  shape?: MaskShape
): (() => void) => {
  if (shape) {
    setCropShape(cropper, shape);
  }

  const { style } = element;

  style.position = "absolute";
  style.inset = "0";
  style.pointerEvents = "none";
  style.transitionProperty = "opacity";
  let last = "";
  let gradient = false;

  const clear = (): void => {
    last = "";

    if (gradient) {
      style.removeProperty("mask-image");
      style.removeProperty("-webkit-mask-image");
    } else {
      style.clipPath = "";
    }
  };

  const view = viewOf(cropper);

  const sync = (): void => {
    element.toggleAttribute("data-interacting", view.chrome().active);
  };

  sync();
  const offChrome = view.onChrome(sync);
  const stop = follow(cropper, (frame) => {
    const current = shape ?? cropShapeOf(cropper);
    const round = current === "circle" && !supportsShape();
    const next = round
      ? maskGradient(frame.rect, frame.layout.dpr)
      : maskClip(frame.rect, current);

    if (next === last) {
      return;
    }

    if (round !== gradient) {
      clear();
      gradient = round;
    }

    last = next;

    if (round) {
      style.setProperty("mask-image", next);
      style.setProperty("-webkit-mask-image", next);
    } else {
      style.clipPath = next;
    }
  });
  const offEmpty = view.onEmpty(clear);

  return () => {
    stop();
    offChrome();
    offEmpty();
    clear();
  };
};

const placedBinds = new WeakMap<HTMLElement, number>();

const countPlaced = (element: HTMLElement, by: number): void => {
  const count = (placedBinds.get(element) ?? 0) + by;

  placedBinds.set(element, count);
  element.toggleAttribute("data-visible", count > 0);
};

const bindArea = (
  cropper: Cropper,
  element: HTMLElement,
  options: AreaOptions = {}
): (() => void) => {
  const { style } = element;

  style.position = "absolute";
  style.transitionProperty = "none";

  if (options.shape === "circle") {
    style.borderRadius = "50%";
  }

  const live = new Map<string, string>();

  const variable = (name: string, value: number): void => {
    const text = String(Math.round(value * 1000) / 1000);

    if (live.get(name) !== text) {
      live.set(name, text);
      style.setProperty(name, text);
    }
  };

  const unset: Box = { height: -1, width: -1, x: Number.NaN, y: Number.NaN };
  let last = unset;
  const stop = follow(cropper, (frame) => {
    const { rect } = frame;

    if (last === unset) {
      countPlaced(element, 1);
    }

    if (rect.x !== last.x) {
      style.left = px(rect.x);
    }

    if (rect.y !== last.y) {
      style.top = px(rect.y);
    }

    if (rect.width !== last.width) {
      style.width = px(rect.width);
    }

    if (rect.height !== last.height) {
      style.height = px(rect.height);
    }

    last = rect;

    if (options.liveVariables === true) {
      const { rotation } = cropper.getValue();
      const zoom = cropper.getZoom();
      const max = cropper.getMaxZoom();
      const shift = viewOf(cropper).overscroll();

      variable("--zriz-rotation", rotation);

      variable(
        "--zriz-rotation-progress",
        rotation / Math.max(cropper.getRotationLimit(), 1e-9)
      );

      variable("--zriz-zoom", zoom);

      variable(
        "--zriz-zoom-progress",
        max > 1 ? Math.log(zoom) / Math.log(max) : 0
      );

      variable("--zriz-overscroll", Math.hypot(shift.x, shift.y));
    }
  });

  const unplace = (): void => {
    if (last !== unset) {
      last = unset;
      countPlaced(element, -1);
    }
  };

  const offEmpty = viewOf(cropper).onEmpty(() => {
    unplace();
    style.left = "";
    style.top = "";
    style.width = "";
    style.height = "";
  });
  const offDisabled = followDisabled(cropper, element);

  return () => {
    stop();
    offEmpty();
    offDisabled();
    unplace();

    for (const name of live.keys()) {
      style.removeProperty(name);
    }

    if (options.shape === "circle") {
      style.borderRadius = "";
    }
  };
};

const boxPlanes = (
  layout: Layout | undefined,
  placement: Placement,
  start: Rect
): HalfPlane[] => {
  if (!layout) {
    return [];
  }

  const { inset, width, height } = layout;
  const { offset, scale } = placement;
  const left = Math.min((inset.left - offset.x) / scale, start.x0);
  const top = Math.min((inset.top - offset.y) / scale, start.y0);
  const right = Math.max((width - inset.right - offset.x) / scale, start.x1);
  const bottom = Math.max((height - inset.bottom - offset.y) / scale, start.y1);

  return [
    { d: right, nx: 1, ny: 0 },
    { d: -left, nx: -1, ny: 0 },
    { d: bottom, nx: 0, ny: 1 },
    { d: -top, nx: 0, ny: -1 },
  ];
};

const toRect = (crop: Crop): Rect => ({
  x0: crop.x - crop.width / 2,
  x1: crop.x + crop.width / 2,
  y0: crop.y - crop.height / 2,
  y1: crop.y + crop.height / 2,
});

const toCrop = (rect: Rect): Crop => ({
  height: rect.y1 - rect.y0,
  width: rect.x1 - rect.x0,
  x: (rect.x0 + rect.x1) / 2,
  y: (rect.y0 + rect.y1) / 2,
});

const handlePoint = (rect: Rect, handle: CropHandle): Point => {
  let x = (rect.x0 + rect.x1) / 2;
  let y = (rect.y0 + rect.y1) / 2;

  if (handle.includes("w")) {
    x = rect.x0;
  } else if (handle.includes("e")) {
    x = rect.x1;
  }

  if (handle.includes("n")) {
    y = rect.y0;
  } else if (handle.includes("s")) {
    y = rect.y1;
  }

  return { x, y };
};

const pairs = (aspect: number | null, a: CropHandle, b: CropHandle): boolean =>
  !new RegExp(`[${a}]`, "u").test(b) &&
  (aspect === null || a.length + b.length === 4);

const PINNED_SLACK = 0.5;
const BATCH_MS = 20;

const sameRect = (a: Rect, b: Rect): boolean =>
  Math.abs(a.x0 - b.x0) < 1e-6 &&
  Math.abs(a.y0 - b.y0) < 1e-6 &&
  Math.abs(a.x1 - b.x1) < 1e-6 &&
  Math.abs(a.y1 - b.y1) < 1e-6;

const toWorking = (point: Point, placement: Placement): Point => ({
  x: (point.x - placement.offset.x) / placement.scale,
  y: (point.y - placement.offset.y) / placement.scale,
});

const resizers = new WeakMap<Cropper, Resizer>();

const createResizer = (cropper: Cropper): Resizer => {
  const owner = {};
  const view = viewOf(cropper);
  const fingers = new Map<number, Finger>();
  let base: ResizeBase | null = null;
  let batch: Batch | null = null;

  const limitsOf = (
    state: CropState,
    planes: readonly HalfPlane[],
    { bounds, placement }: Pick<ResizeBase, "bounds" | "placement">
  ): DragLimits => {
    const span = MIN_HANDLE_SPAN / placement.scale;
    const min = (cropper as CropperInternals).getMinSize();

    return {
      aspect: state.aspect,
      minHeight: Math.max(span, min.height),
      minWidth: Math.max(span, min.width),
      planes: [...planes, ...bounds],
    };
  };

  const rebase = (state: CropState): boolean => {
    const placement = view.hold();

    if (!placement) {
      return false;
    }

    batch = null;
    const start = toRect(state.crop);
    const next = {
      bounds: boxPlanes(view.frame()?.layout, placement, start),
      placement,
      start,
    };
    const limits = limitsOf(state, imagePlanes(state), next);

    for (const finger of fingers.values()) {
      const pointer = toWorking(finger.at, placement);
      const { grab, handle } = finger;
      const anchor = handlePoint(start, handle);
      const wanted = grab && { x: pointer.x - grab.x, y: pointer.y - grab.y };
      const pinned =
        state.aspect === null &&
        wanted !== null &&
        Math.hypot(wanted.x - anchor.x, wanted.y - anchor.y) * placement.scale >
          PINNED_SLACK &&
        sameRect(dragHandle(start, handle, wanted, limits), start);

      if (!pinned) {
        finger.grab = { x: pointer.x - anchor.x, y: pointer.y - anchor.y };
      }
    }

    base = next;

    return true;
  };

  const unpair = (state: CropState): boolean => {
    const [first, second] = fingers;

    if (
      !first ||
      !second ||
      pairs(state.aspect, first[1].handle, second[1].handle)
    ) {
      return false;
    }

    fingers.delete(second[0]);
    second[1].drop();

    return true;
  };

  const drop = (): void => {
    const held = [...fingers.values()];

    fingers.clear();
    base = null;
    batch = null;

    for (const finger of held) {
      finger.drop();
    }
  };

  const end = (event?: Event): void => {
    drop();
    view.release();
    cropper.end(event, owner);
  };

  const batchOf = (
    event: PointerEvent,
    moving: Finger,
    before: Point,
    state: CropState
  ): Batch => {
    if (
      !batch ||
      batch.moved.has(moving) ||
      !(event.timeStamp - batch.time <= BATCH_MS)
    ) {
      batch = {
        at: new Map(
          [...fingers.values()].map((held) => [
            held,
            held === moving ? before : held.at,
          ])
        ),
        moved: new Set(),
        rect: toRect(state.crop),
        time: event.timeStamp,
      };
    }

    batch.moved.add(moving);

    return batch;
  };

  const shift = (
    finger: Finger,
    placement: Placement
  ): { by: Point; handle: CropHandle } => {
    const was = batch?.at.get(finger) ?? finger.at;

    return {
      by: {
        x: (finger.at.x - was.x) / placement.scale,
        y: (finger.at.y - was.y) / placement.scale,
      },
      handle: finger.handle,
    };
  };

  const target = (finger: Finger, placement: Placement): Point => {
    const pointer = toWorking(finger.at, placement);
    const grab = finger.grab ?? pointer;

    return { x: pointer.x - grab.x, y: pointer.y - grab.y };
  };

  return {
    cancel(event) {
      drop();
      (cropper as CropperInternals).rebase(owner);
      cropper.cancel(event, owner);
      view.release();
    },
    join(event, handle, state, release) {
      const [first, extra] = fingers.values();

      if (fingers.has(event.pointerId)) {
        return false;
      }

      if (first) {
        if (extra || !pairs(state.aspect, first.handle, handle)) {
          return false;
        }
      } else if (!cropper.begin("resize", event, owner)) {
        return false;
      }

      fingers.set(event.pointerId, {
        at: view.local(event),
        drop: release,
        grab: null,
        handle,
      });

      if (rebase(state)) {
        return true;
      }

      fingers.delete(event.pointerId);

      if (!first) {
        cropper.end(event, owner);
      }

      return false;
    },
    leave(id, event) {
      const finger = fingers.get(id);

      if (!finger) {
        return;
      }

      fingers.delete(id);
      finger.drop();
      const state = fingers.size > 0 ? cropper.getCropState() : null;

      if (!state || !rebase(state)) {
        end(event);
      }
    },
    move(event) {
      const finger = fingers.get(event.pointerId);

      if (!finger) {
        return;
      }

      const before = finger.at;

      finger.at = view.local(event);

      if ((cropper as CropperInternals).rebase(owner)) {
        view.release();
        const fresh = cropper.getCropState();

        if (!fresh || !rebase(fresh)) {
          end(event);

          return;
        }
      }

      const state = cropper.getCropState();

      if (!state || !base) {
        return;
      }

      if (unpair(state)) {
        if (!rebase(state)) {
          end(event);

          return;
        }

        if (!fingers.has(event.pointerId)) {
          return;
        }
      }

      const { placement, start } = base;
      const planes = imagePlanes(state);
      const limits = limitsOf(state, planes, base);
      const [first = finger, second] = fingers.values();
      const both =
        second !== undefined &&
        pairs(limits.aspect, first.handle, second.handle)
          ? second
          : null;
      let rect = start;
      let from = start;

      if (both && limits.aspect !== null) {
        from = batchOf(event, finger, before, state).rect;

        rect = pairRect(
          from,
          [shift(first, placement), shift(both, placement)],
          limits
        );
      } else {
        for (const held of both ? [first, both, first] : [first]) {
          rect = dragHandle(rect, held.handle, target(held, placement), limits);
        }
      }

      cropper.setCropState(
        {
          ...state,
          crop: stopAtZoomCeiling(
            planes,
            toCrop(from),
            toCrop(rect),
            cropper.getMaxZoom(),
            state.aspect !== null
          ),
        },
        { event, keep: "size", reason: "resize" }
      );
    },
  };
};

const resizerOf = (cropper: Cropper): Resizer => {
  let resizer = resizers.get(cropper);

  if (!resizer) {
    resizer = createResizer(cropper);
    resizers.set(cropper, resizer);
  }

  return resizer;
};

const handleHandlers = (
  cropper: Cropper,
  edge: HandleEdge | (() => HandleEdge),
  element?: () => Element | null,
  onHeld?: (held: boolean) => void
): HandleHandlers => {
  const resizer = resizerOf(cropper);
  let id: number | null = null;
  let releaseCursor: (() => void) | null = null;
  let unwatch: (() => void) | null = null;

  const drop = (): void => {
    id = null;
    releaseCursor?.();
    releaseCursor = null;
    unwatch?.();
    unwatch = null;
    onHeld?.(false);
  };

  const lost = (event?: Event): void => {
    if (id !== null) {
      resizer.leave(id, event);
    }
  };

  const finish = (event: PointerEvent): void => {
    if (id === event.pointerId) {
      lost(event);
    }
  };

  return {
    onLostPointerCapture: finish,
    onPointerCancel: finish,
    onPointerDown(event) {
      claim(event);
      const state = cropper.getCropState();

      if (
        id !== null ||
        !state ||
        !presses(event) ||
        !resizer.join(
          event,
          EDGES[typeof edge === "function" ? edge() : edge],
          state,
          drop
        )
      ) {
        return;
      }

      id = event.pointerId;
      const target = targetOf(event, element);
      const offEscape = watchEscape(target, resizer.cancel);
      const offLoss = watchLoss(cropper, lost, (held) => held === id, target);

      unwatch = () => {
        offLoss();
        offEscape();
      };

      if (target) {
        capture(target, event.pointerId);

        if (event.pointerType !== "touch") {
          releaseCursor = holdCursor(target);
        }
      }

      onHeld?.(true);
    },
    onPointerMove(event) {
      if (id !== event.pointerId) {
        return;
      }

      if (pressLost(event, targetOf(event, element))) {
        lost(event);

        return;
      }

      resizer.move(event);
    },
    onPointerUp: finish,
    release: lost,
  };
};

const bindHandle = (
  cropper: Cropper,
  element: HTMLElement,
  edge: HandleEdge
): (() => void) => {
  const handlers = handleHandlers(cropper, edge);
  const unclaim = claimTouch(element, "none");

  element.dataset.edge = edge;
  const off = bindPointers(element, handlers);

  return () => {
    off();
    handlers.release();
    unclaim();
  };
};

const bindState = (cropper: Cropper, element: HTMLElement): (() => void) => {
  const view = viewOf(cropper);

  const sync = (): void => {
    for (const [name, value] of Object.entries(
      stateAttributes(cropper.getState(), view.chrome(), view.reducedMotion())
    )) {
      if (value === undefined) {
        element.removeAttribute(name);
      } else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
      }
    }
  };

  sync();
  const offState = cropper.subscribe(sync);
  const offChrome = view.onChrome(sync);

  return () => {
    offState();
    offChrome();
  };
};

export type { AreaOptions, HandleEdge, HandleHandlers, MaskShape };
export {
  bindArea,
  bindHandle,
  bindImage,
  bindMask,
  bindState,
  handleHandlers,
  maskClip,
  maskGradient,
};
