import type { Cropper } from "../cropper";
import { dragHandle } from "../geometry/constraints";
import type { CropHandle } from "../geometry/constraints";
import { imagePlanes } from "../geometry/planes";
import type { Point, Rect } from "../geometry/types";
import { capture, cssMatrix, viewOf } from "./view";
import type { Box, Placement, ViewFrame } from "./view";

export type MaskShape = "rect" | "circle";

const MIN_HANDLE_SPAN = 88;

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

export const maskClip = (rect: Box, shape: MaskShape): string => {
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

export const maskGradient = (rect: Box, dpr: number): string => {
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

export const bindImage = (
  cropper: Cropper,
  element: HTMLElement
): (() => void) => {
  const { style } = element;
  style.position = "absolute";
  style.left = "0";
  style.top = "0";
  style.maxWidth = "none";
  style.transformOrigin = "0 0";
  style.pointerEvents = "none";
  style.setProperty("-webkit-user-drag", "none");
  if (element instanceof HTMLImageElement) {
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
  const unsubscribe = cropper.subscribe(sync);
  return () => {
    stop();
    unsubscribe();
  };
};

export const bindMask = (
  cropper: Cropper,
  element: HTMLElement,
  shape: MaskShape = "rect"
): (() => void) => {
  const { style } = element;
  style.position = "absolute";
  style.inset = "0";
  style.pointerEvents = "none";
  let last = "";
  return follow(cropper, (frame) => {
    if (shape === "circle" && !supportsShape()) {
      const next = maskGradient(frame.rect, frame.layout.dpr);
      if (next !== last) {
        last = next;
        style.setProperty("mask-image", next);
        style.setProperty("-webkit-mask-image", next);
      }
      return;
    }
    const next = maskClip(frame.rect, shape);
    if (next !== last) {
      last = next;
      style.clipPath = next;
    }
  });
};

export const bindArea = (
  cropper: Cropper,
  element: HTMLElement
): (() => void) => {
  const { style } = element;
  style.position = "absolute";
  let last: Box = { height: -1, width: -1, x: Number.NaN, y: Number.NaN };
  return follow(cropper, (frame) => {
    const { rect } = frame;
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
  });
};

export interface HandleHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onLostPointerCapture: (event: PointerEvent) => void;
}

interface HandleDrag {
  id: number;
  placement: Placement;
  start: Rect;
  grab: Point;
}

const toRect = (crop: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Rect => ({
  x0: crop.x - crop.width / 2,
  x1: crop.x + crop.width / 2,
  y0: crop.y - crop.height / 2,
  y1: crop.y + crop.height / 2,
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

export const handleHandlers = (
  cropper: Cropper,
  handle: CropHandle,
  element?: () => Element | null
): HandleHandlers => {
  const view = viewOf(cropper);
  let drag: HandleDrag | null = null;

  const toWorking = (event: PointerEvent, placement: Placement): Point => {
    const point = view.local(event);
    return {
      x: (point.x - placement.offset.x) / placement.scale,
      y: (point.y - placement.offset.y) / placement.scale,
    };
  };

  const finish = (event: PointerEvent): void => {
    if (drag?.id !== event.pointerId) {
      return;
    }
    drag = null;
    view.release();
    cropper.end(event);
  };

  return {
    onLostPointerCapture: finish,
    onPointerCancel: finish,
    onPointerDown(event) {
      view.claim(event);
      const state = cropper.getCropState();
      if (
        drag ||
        !state ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        !cropper.begin("resize", event)
      ) {
        return;
      }
      const placement = view.hold();
      if (!placement) {
        cropper.end(event);
        return;
      }
      const start = toRect(state.crop);
      const pointer = toWorking(event, placement);
      const anchor = handlePoint(start, handle);
      drag = {
        grab: { x: pointer.x - anchor.x, y: pointer.y - anchor.y },
        id: event.pointerId,
        placement,
        start,
      };
      const target =
        element?.() ??
        (event.currentTarget instanceof Element ? event.currentTarget : null);
      if (target) {
        capture(target, event.pointerId);
      }
    },
    onPointerMove(event) {
      const state = cropper.getCropState();
      if (drag?.id !== event.pointerId || !state) {
        return;
      }
      const pointer = toWorking(event, drag.placement);
      const span = MIN_HANDLE_SPAN / drag.placement.scale;
      const rect = dragHandle(
        drag.start,
        handle,
        { x: pointer.x - drag.grab.x, y: pointer.y - drag.grab.y },
        {
          aspect: state.aspect,
          minHeight: span,
          minWidth: span,
          planes: imagePlanes(state),
        }
      );
      cropper.setCropState(
        {
          ...state,
          crop: {
            height: rect.y1 - rect.y0,
            width: rect.x1 - rect.x0,
            x: (rect.x0 + rect.x1) / 2,
            y: (rect.y0 + rect.y1) / 2,
          },
        },
        { event, keep: "size", reason: "resize" }
      );
    },
    onPointerUp: finish,
  };
};

export const bindHandle = (
  cropper: Cropper,
  element: HTMLElement,
  handle: CropHandle
): (() => void) => {
  const handlers = handleHandlers(cropper, handle);
  element.style.touchAction = "none";
  element.addEventListener("pointerdown", handlers.onPointerDown);
  element.addEventListener("pointermove", handlers.onPointerMove);
  element.addEventListener("pointerup", handlers.onPointerUp);
  element.addEventListener("pointercancel", handlers.onPointerCancel);
  element.addEventListener("lostpointercapture", handlers.onLostPointerCapture);
  return () => {
    element.removeEventListener("pointerdown", handlers.onPointerDown);
    element.removeEventListener("pointermove", handlers.onPointerMove);
    element.removeEventListener("pointerup", handlers.onPointerUp);
    element.removeEventListener("pointercancel", handlers.onPointerCancel);
    element.removeEventListener(
      "lostpointercapture",
      handlers.onLostPointerCapture
    );
  };
};

const reasonAttribute: Partial<Record<string, string>> = {
  dial: "rotating",
  pan: "panning",
  pinch: "pinching",
  resize: "resizing",
  wheel: "zooming",
  "zoom-control": "zooming",
};

export const bindState = (
  cropper: Cropper,
  element: HTMLElement
): (() => void) => {
  const view = viewOf(cropper);
  let gesture: string | undefined;
  const sync = (): void => {
    const state = cropper.getState();
    const chrome = view.chrome();
    element.toggleAttribute("data-interacting", chrome.active);
    element.toggleAttribute("data-settling", state.settling);
    element.toggleAttribute("data-changed", !state.pristine);
    element.toggleAttribute("data-mirrored", state.mirrored);
    element.toggleAttribute("data-reduced-motion", view.reducedMotion());
    element.dataset.grid = chrome.grid;
    if (chrome.transition) {
      element.dataset.transition = chrome.transition;
    } else {
      delete element.dataset.transition;
    }
    const next = state.interacting
      ? reasonAttribute[state.interacting]
      : undefined;
    if (next !== gesture) {
      if (gesture !== undefined) {
        element.removeAttribute(`data-${gesture}`);
      }
      if (next !== undefined) {
        element.setAttribute(`data-${next}`, "");
      }
      gesture = next;
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
