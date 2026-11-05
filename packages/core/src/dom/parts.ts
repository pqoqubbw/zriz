import type { Cropper, CropperInternals } from "../cropper";
import { dragHandle } from "../geometry/constraints";
import type { CropHandle } from "../geometry/constraints";
import { applyHomography, invertMatrix3 } from "../geometry/matrix";
import { imagePlanes } from "../geometry/planes";
import type {
  Crop,
  CropState,
  HalfPlane,
  Matrix3,
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
  clipBox,
  clipPath,
  cssMatrix,
  stateAttributes,
  viewOf,
} from "./view";
import type { Box, Layout, Placement, Quad, ViewFrame } from "./view";

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

type HandleDrag = {
  handle: CropHandle;
  id: number;
  placement: Placement;
  start: Rect;
  grab: Point;
  bounds: HalfPlane[];
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

const maskClip = (
  given: Box,
  shape: MaskShape,
  clip: Quad | null = null
): string => {
  const rect = clip ? clipBox(clip) : given;
  const x0 = px(rect.x);
  const y0 = px(rect.y);

  if (shape === "circle") {
    const rx = px(rect.width / 2);
    const ry = px(rect.height / 2);

    return `shape(evenodd from 0 0, hline to 100%, vline to 100%, hline to 0, close, move to ${px(rect.x + rect.width / 2)} ${y0}, arc by 0 ${px(rect.height)} of ${rx} ${ry}, arc by 0 ${px(-rect.height)} of ${rx} ${ry}, close)`;
  }

  const x1 = px(rect.x + rect.width);
  const y1 = px(rect.y + rect.height);
  const hole = clip
    ? clip.map((point) => `${px(point.x)} ${px(point.y)}`)
    : [`${x0} ${y0}`, `${x1} ${y0}`, `${x1} ${y1}`, `${x0} ${y1}`];

  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${[...hole, hole[0]].join(", ")})`;
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

const localQuad = ([a, b, c, d]: Quad, matrix: Matrix3): Quad => {
  const inverse = invertMatrix3(matrix);

  return [
    applyHomography(inverse, a),
    applyHomography(inverse, b),
    applyHomography(inverse, c),
    applyHomography(inverse, d),
  ];
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
  let clipped = "";
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

    const clip = clipPath(
      frame.clip && localQuad(frame.clip, frame.matrix),
      cropShapeOf(cropper)
    );

    if (clip !== clipped) {
      clipped = clip;
      style.clipPath = clip;
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

  return () => {
    stop();
    offState();
    style.clipPath = "";
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
      ? maskGradient(
          frame.clip ? clipBox(frame.clip) : frame.rect,
          frame.layout.dpr
        )
      : maskClip(frame.rect, current, frame.clip);

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

const handleHandlers = (
  cropper: Cropper,
  edge: HandleEdge | (() => HandleEdge),
  element?: () => Element | null
): HandleHandlers => {
  const owner = {};
  let releaseCursor: (() => void) | null = null;
  let unwatch: (() => void) | null = null;
  const view = viewOf(cropper);
  let drag: HandleDrag | null = null;

  const toWorking = (event: PointerEvent, placement: Placement): Point => {
    const point = view.local(event);

    return {
      x: (point.x - placement.offset.x) / placement.scale,
      y: (point.y - placement.offset.y) / placement.scale,
    };
  };

  const drop = (): void => {
    drag = null;
    releaseCursor?.();
    releaseCursor = null;
    unwatch?.();
    unwatch = null;
  };

  const onEscape = (event: KeyboardEvent): void => {
    drop();
    (cropper as CropperInternals).rebase(owner);
    cropper.cancel(event, owner);
    view.release();
  };

  const lost = (event?: Event): void => {
    if (drag) {
      drop();
      view.release();
      cropper.end(event, owner);
    }
  };

  const finish = (event: PointerEvent): void => {
    if (drag?.id === event.pointerId) {
      lost(event);
    }
  };

  const grab = (
    event: PointerEvent,
    state: CropState,
    handle: CropHandle
  ): HandleDrag | null => {
    const placement = view.hold();

    if (!placement) {
      return null;
    }

    const start = toRect(state.crop);
    const pointer = toWorking(event, placement);
    const anchor = handlePoint(start, handle);

    return {
      bounds: boxPlanes(view.frame()?.layout, placement, start),
      grab: { x: pointer.x - anchor.x, y: pointer.y - anchor.y },
      handle,
      id: event.pointerId,
      placement,
      start,
    };
  };

  return {
    onLostPointerCapture: finish,
    onPointerCancel: finish,
    onPointerDown(event) {
      claim(event);
      const state = cropper.getCropState();

      if (
        drag ||
        !state ||
        !presses(event) ||
        !cropper.begin("resize", event, owner)
      ) {
        return;
      }

      drag = grab(
        event,
        state,
        EDGES[typeof edge === "function" ? edge() : edge]
      );

      if (!drag) {
        cropper.end(event, owner);

        return;
      }

      const target = targetOf(event, element);
      const offEscape = watchEscape(target, onEscape);
      const offLoss = watchLoss(cropper, lost, (id) => id === drag?.id, target);

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
    },
    onPointerMove(event) {
      if (drag?.id !== event.pointerId) {
        return;
      }

      if (pressLost(event, targetOf(event, element))) {
        lost(event);

        return;
      }

      if ((cropper as CropperInternals).rebase(owner)) {
        view.release();
        const fresh = cropper.getCropState();
        const next = fresh && grab(event, fresh, drag.handle);

        if (!next) {
          lost(event);

          return;
        }

        drag = next;
      }

      const state = cropper.getCropState();

      if (!state) {
        return;
      }

      const pointer = toWorking(event, drag.placement);
      const span = MIN_HANDLE_SPAN / drag.placement.scale;
      const min = (cropper as CropperInternals).getMinSize();
      const planes = imagePlanes(state);
      const rect = dragHandle(
        drag.start,
        drag.handle,
        { x: pointer.x - drag.grab.x, y: pointer.y - drag.grab.y },
        {
          aspect: state.aspect,
          minHeight: Math.max(span, min.height),
          minWidth: Math.max(span, min.width),
          planes: [...planes, ...drag.bounds],
        }
      );

      cropper.setCropState(
        {
          ...state,
          crop: stopAtZoomCeiling(
            planes,
            toCrop(drag.start),
            toCrop(rect),
            cropper.getMaxZoom(),
            state.aspect !== null
          ),
        },
        { event, keep: "size", reason: "resize" }
      );
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
