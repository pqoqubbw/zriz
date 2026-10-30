import type { Cropper } from "../cropper";
import { rubberBandPoint } from "../geometry/band";
import { applyMatrix2, rotationMatrix } from "../geometry/matrix";
import { sourceToWorking, workingToSource } from "../geometry/state";
import type { CropState, Point } from "../geometry/types";
import { capture, viewOf } from "./view";
import type { Layout, View } from "./view";

export type WheelMode = "pan" | "zoom" | "none";

export interface ViewportOptions {
  wheel?: WheelMode | undefined;
  rotateGesture?: boolean | undefined;
}

export interface ViewportHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onLostPointerCapture: (event: PointerEvent) => void;
}

export interface ViewportController {
  handlers: ViewportHandlers;
  setElement: (element: HTMLElement | null) => void;
  setOptions: (options: ViewportOptions) => void;
  destroy: () => void;
}

interface SafariGestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}

interface Start {
  state: CropState;
  scale: number;
  centroid: Point;
  distance: number;
  angle: number;
}

const PAN_BAND = 125;
const ROTATE_DEAD_ZONE = 5;
const WHEEL_IDLE = 150;
const LINE_HEIGHT = 16;

const centroidOf = (points: readonly Point[]): Point => {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
};

const spread = (
  points: readonly Point[]
): { distance: number; angle: number } => {
  const [a, b] = points;
  if (!a || !b) {
    return { angle: 0, distance: 1 };
  }
  return {
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    distance: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1),
  };
};

const pixels = (value: string): number => Number(value.slice(0, -2)) || 0;

const isGesture = (event: Event): event is SafariGestureEvent =>
  "scale" in event && "rotation" in event;

const wrapDegrees = (degrees: number): number =>
  ((((degrees + 180) % 360) + 360) % 360) - 180;

export const transformAround = (
  start: CropState,
  scale: number,
  rect: Point,
  from: Point,
  to: Point,
  ratio: number,
  turn: number,
  offset: Point
): CropState => {
  const local = applyMatrix2(rotationMatrix(-turn), {
    x: (rect.x - to.x) / ratio,
    y: (rect.y - to.y) / ratio,
  });
  const working = {
    x: (local.x + from.x - offset.x) / scale,
    y: (local.y + from.y - offset.y) / scale,
  };
  const source = workingToSource(start, working);
  const turned = { ...start, angle: start.angle + turn };
  const centre = sourceToWorking(turned, source);
  return {
    ...turned,
    crop: {
      height: start.crop.height / ratio,
      width: start.crop.width / ratio,
      x: centre.x,
      y: centre.y,
    },
  };
};

export const viewportController = (
  cropper: Cropper,
  initial: ViewportOptions = {}
): ViewportController => {
  const owner = {};
  let options = initial;
  let element: HTMLElement | null = null;
  const view: View = viewOf(cropper);
  const pointers = new Map<number, Point>();
  let origin: Point = { x: 0, y: 0 };
  let start: Start | null = null;
  let rotating = false;
  let safari: Start | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: ResizeObserver | null = null;
  let dprQuery: MediaQueryList | null = null;

  const measure = (): void => {
    if (!element) {
      view.setLayout(null);
      return;
    }
    const style = getComputedStyle(element);
    const layout: Layout = {
      dpr: globalThis.devicePixelRatio || 1,
      height: element.clientHeight,
      inset: {
        bottom: pixels(style.paddingBottom),
        left: pixels(style.paddingLeft),
        right: pixels(style.paddingRight),
        top: pixels(style.paddingTop),
      },
      width: element.clientWidth,
    };
    view.setLayout(layout.width > 0 && layout.height > 0 ? layout : null);
  };

  const onDpr = (): void => {
    dprQuery?.removeEventListener("change", onDpr);
    dprQuery =
      globalThis.matchMedia?.(
        `(resolution: ${globalThis.devicePixelRatio || 1}dppx)`
      ) ?? null;
    dprQuery?.addEventListener("change", onDpr);
    measure();
  };

  const onAncestorSettle = (event: Event): void => {
    if (
      element &&
      event.target instanceof Node &&
      event.target.contains(element)
    ) {
      measure();
    }
  };

  const local = (event: { clientX: number; clientY: number }): Point => ({
    x: event.clientX - origin.x,
    y: event.clientY - origin.y,
  });

  const rebase = (): void => {
    const state = cropper.getCropState();
    const frame = view.frame();
    if (!state || !frame || pointers.size === 0) {
      start = null;
      return;
    }
    const points = [...pointers.values()];
    const { distance, angle } = spread(points);
    start = {
      angle,
      centroid: centroidOf(points),
      distance,
      scale: frame.scale,
      state,
    };
    rotating = false;
  };

  const offsetOf = (begin: Start): Point => {
    const frame = view.frame();
    const rect = frame?.rect;
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: rect.x + rect.width / 2 - begin.scale * begin.state.crop.x,
      y: rect.y + rect.height / 2 - begin.scale * begin.state.crop.y,
    };
  };

  const rectCentre = (): Point | null => {
    const rect = view.frame()?.rect;
    return rect
      ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      : null;
  };

  const pan = (begin: Start, delta: Point, event: Event): boolean => {
    const before = cropper.getCropState();
    const desired = {
      x: begin.state.crop.x - delta.x / begin.scale,
      y: begin.state.crop.y - delta.y / begin.scale,
    };
    cropper.setCropState(
      { ...begin.state, crop: { ...begin.state.crop, ...desired } },
      { event, keep: "size", reason: cropper.getState().interacting ?? "pan" }
    );
    const after = cropper.getCropState();
    if (!after) {
      return false;
    }
    const excess = {
      x: (desired.x - after.crop.x) * -begin.scale,
      y: (desired.y - after.crop.y) * -begin.scale,
    };
    view.setOverscroll(rubberBandPoint(excess, { x: 0, y: 0 }, PAN_BAND, 1));
    return before !== after;
  };

  const pinch = (
    begin: Start,
    centroid: Point,
    ratio: number,
    turnRaw: number,
    event: Event
  ): void => {
    const centre = rectCentre();
    if (!centre) {
      return;
    }
    let turn = 0;
    if (options.rotateGesture !== false) {
      if (!rotating && Math.abs(turnRaw) > ROTATE_DEAD_ZONE) {
        rotating = true;
      }
      if (rotating) {
        turn = turnRaw - Math.sign(turnRaw) * ROTATE_DEAD_ZONE;
      }
    }
    const next = transformAround(
      begin.state,
      begin.scale,
      centre,
      begin.centroid,
      centroid,
      ratio,
      turn,
      offsetOf(begin)
    );
    cropper.setCropState(next, {
      event,
      keep: turn === 0 ? "size" : "centre",
      reason: "pinch",
    });
  };

  const finish = (id: number, event: Event): void => {
    if (!pointers.delete(id)) {
      return;
    }
    if (pointers.size > 0) {
      rebase();
      return;
    }
    start = null;
    view.settleOverscroll();
    cropper.end(event, owner);
  };

  const handlers: ViewportHandlers = {
    onLostPointerCapture(event) {
      finish(event.pointerId, event);
    },
    onPointerCancel(event) {
      finish(event.pointerId, event);
    },
    onPointerDown(event) {
      if (
        view.claimed(event) ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        Math.floor(event.buttons / 32) % 2 === 1 ||
        pointers.size >= 2 ||
        !element ||
        !cropper.getCropState()
      ) {
        return;
      }
      if (pointers.size === 0) {
        const box = element.getBoundingClientRect();
        origin = {
          x: box.left + element.clientLeft,
          y: box.top + element.clientTop,
        };
        if (!cropper.begin("pan", event, owner)) {
          return;
        }
      } else {
        cropper.begin("pinch", event, owner);
      }
      capture(element, event.pointerId);
      pointers.set(event.pointerId, local(event));
      rebase();
    },
    onPointerMove(event) {
      if (!pointers.has(event.pointerId) || !start) {
        return;
      }
      const samples = event.getCoalescedEvents?.() ?? [];
      const last = samples.at(-1) ?? event;
      pointers.set(event.pointerId, local(last));
      const points = [...pointers.values()];
      const centroid = centroidOf(points);
      if (points.length === 1) {
        pan(
          start,
          {
            x: centroid.x - start.centroid.x,
            y: centroid.y - start.centroid.y,
          },
          event
        );
        return;
      }
      const { distance, angle } = spread(points);
      pinch(
        start,
        centroid,
        distance / start.distance,
        wrapDegrees(angle - start.angle),
        event
      );
    },
    onPointerUp(event) {
      finish(event.pointerId, event);
    },
  };

  const endWheel = (): void => {
    wheelTimer = null;
    if (pointers.size === 0 && !safari) {
      cropper.end(undefined, owner);
    }
  };

  const onWheel = (event: WheelEvent): void => {
    if (!element || pointers.size > 0 || !cropper.getCropState()) {
      return;
    }
    const dy = event.deltaY;
    const dx = event.deltaX;
    let unit = 1;
    if (event.deltaMode === 1) {
      unit = LINE_HEIGHT;
    } else if (event.deltaMode === 2) {
      unit = element.clientHeight;
    }
    const zoom = event.ctrlKey || options.wheel === "zoom";
    if (event.ctrlKey && safari) {
      event.preventDefault();
      return;
    }
    if (!zoom && options.wheel === "none") {
      return;
    }
    const box = element.getBoundingClientRect();
    origin = {
      x: box.left + element.clientLeft,
      y: box.top + element.clientTop,
    };
    const state = cropper.getCropState();
    const frame = view.frame();
    if (!state || !frame) {
      return;
    }
    if (wheelTimer === null) {
      if (!cropper.begin("wheel", event, owner)) {
        if (zoom) {
          event.preventDefault();
        }
        return;
      }
    } else {
      clearTimeout(wheelTimer);
    }
    wheelTimer = setTimeout(endWheel, WHEEL_IDLE);
    const begin: Start = {
      angle: 0,
      centroid: local(event),
      distance: 1,
      scale: frame.scale,
      state,
    };
    if (zoom) {
      event.preventDefault();
      const step = Math.min(Math.max(dy * unit, -50), 50);
      pinch(begin, begin.centroid, Math.exp(-step / 100), 0, event);
      return;
    }
    const delta =
      event.shiftKey && dx === 0
        ? { x: -dy * unit, y: 0 }
        : { x: -dx * unit, y: -dy * unit };
    if (pan(begin, delta, event)) {
      event.preventDefault();
    }
    view.setOverscroll({ x: 0, y: 0 });
  };

  const onGestureStart = (event: Event): void => {
    event.preventDefault();
    const state = cropper.getCropState();
    const frame = view.frame();
    if (pointers.size > 0 || !element || !state || !frame) {
      return;
    }
    if (!isGesture(event)) {
      return;
    }
    const box = element.getBoundingClientRect();
    origin = {
      x: box.left + element.clientLeft,
      y: box.top + element.clientTop,
    };
    if (!cropper.begin("pinch", event, owner)) {
      return;
    }
    rotating = false;
    safari = {
      angle: 0,
      centroid: local(event),
      distance: 1,
      scale: frame.scale,
      state,
    };
  };

  const onGestureChange = (event: Event): void => {
    event.preventDefault();
    if (!safari || !isGesture(event)) {
      return;
    }
    pinch(safari, local(event), event.scale || 1, event.rotation || 0, event);
  };

  const onGestureEnd = (event: Event): void => {
    event.preventDefault();
    if (!safari) {
      return;
    }
    safari = null;
    cropper.end(event, owner);
  };

  const onHidden = (): void => {
    if (document.visibilityState === "hidden") {
      for (const id of pointers.keys()) {
        finish(id, new Event("visibilitychange"));
      }
    }
  };

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || pointers.size === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pointers.clear();
    start = null;
    view.setOverscroll({ x: 0, y: 0 });
    cropper.cancel(event, owner);
  };

  const onBlur = (event: Event): void => {
    for (const id of pointers.keys()) {
      finish(id, event);
    }
  };

  const detach = (): void => {
    if (!element) {
      return;
    }
    observer?.disconnect();
    observer = null;
    dprQuery?.removeEventListener("change", onDpr);
    dprQuery = null;
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("gesturestart", onGestureStart);
    element.removeEventListener("gesturechange", onGestureChange);
    element.removeEventListener("gestureend", onGestureEnd);
    document.removeEventListener("transitionend", onAncestorSettle, true);
    document.removeEventListener("animationend", onAncestorSettle, true);
    document.removeEventListener("visibilitychange", onHidden);
    globalThis.removeEventListener("blur", onBlur);
    globalThis.removeEventListener("keydown", onEscape, true);
    for (const id of pointers.keys()) {
      finish(id, new Event("lostpointercapture"));
    }
    if (safari) {
      safari = null;
      cropper.end(new Event("gestureend"), owner);
    }
    element = null;
  };

  return {
    destroy() {
      detach();
      if (wheelTimer !== null) {
        clearTimeout(wheelTimer);
        wheelTimer = null;
      }
      view.setLayout(null);
    },
    handlers,
    setElement(next) {
      if (next === element) {
        return;
      }
      detach();
      element = next;
      view.setTarget(next);
      if (!next) {
        view.setLayout(null);
        return;
      }
      next.style.touchAction = "none";
      next.style.userSelect = "none";
      next.style.setProperty("-webkit-user-select", "none");
      next.style.setProperty("-webkit-touch-callout", "none");
      next.style.setProperty("-webkit-tap-highlight-color", "transparent");
      next.addEventListener("wheel", onWheel, { passive: false });
      next.addEventListener("gesturestart", onGestureStart);
      next.addEventListener("gesturechange", onGestureChange);
      next.addEventListener("gestureend", onGestureEnd);
      document.addEventListener("transitionend", onAncestorSettle, true);
      document.addEventListener("animationend", onAncestorSettle, true);
      document.addEventListener("visibilitychange", onHidden);
      globalThis.addEventListener("blur", onBlur);
      globalThis.addEventListener("keydown", onEscape, true);
      observer = new ResizeObserver(measure);
      observer.observe(next);
      onDpr();
    },
    setOptions(next) {
      options = next;
    },
  };
};

export const bindViewport = (
  cropper: Cropper,
  element: HTMLElement,
  options?: ViewportOptions
): (() => void) => {
  const controller = viewportController(cropper, options);
  const { handlers } = controller;
  element.addEventListener("pointerdown", handlers.onPointerDown);
  element.addEventListener("pointermove", handlers.onPointerMove);
  element.addEventListener("pointerup", handlers.onPointerUp);
  element.addEventListener("pointercancel", handlers.onPointerCancel);
  element.addEventListener("lostpointercapture", handlers.onLostPointerCapture);
  controller.setElement(element);
  return () => {
    element.removeEventListener("pointerdown", handlers.onPointerDown);
    element.removeEventListener("pointermove", handlers.onPointerMove);
    element.removeEventListener("pointerup", handlers.onPointerUp);
    element.removeEventListener("pointercancel", handlers.onPointerCancel);
    element.removeEventListener(
      "lostpointercapture",
      handlers.onLostPointerCapture
    );
    controller.destroy();
  };
};
