import type { Cropper } from "../cropper";
import {
  inverseRubberBand,
  rubberBand,
  rubberBandPoint,
} from "../geometry/band";
import { largestFit } from "../geometry/coverage";
import { applyMatrix2, rotationMatrix } from "../geometry/matrix";
import { imagePlanes, insidePlanes, panPlanes } from "../geometry/planes";
import { sourceToWorking, workingToSource } from "../geometry/state";
import type { CropState, Point } from "../geometry/types";
import { holdCursor } from "./cursor";
import { bindPointers, capture } from "./input";
import type { PointerHandlers } from "./input";
import { viewOf } from "./view";
import type { Layout, View } from "./view";

export type WheelMode = "pan" | "zoom" | "none";

export interface ViewportOptions {
  wheel?: WheelMode | undefined;
  rotateGesture?: boolean | undefined;
}

export type ViewportHandlers = PointerHandlers;

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
const ZOOM_NOISE = 1e-6;
const ZOOM_REACH = 2;
const PAD_BAND = 0.08;
const PAD_REACH = 0.5;
const PAN_NOISE = 0.01;
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

const bandZoom = (excess: number): number => {
  const shown = 0.5 + 0.5 / (3 - 2 * Math.exp(-Math.abs(excess)));
  return excess < 0 ? shown : 1 / shown;
};

const padZoom = (excess: number): number =>
  Math.exp(Math.sign(excess) * rubberBand(Math.abs(excess), PAD_BAND));

const unpadZoom = (zoom: number): number => {
  const shown = Math.log(zoom);
  return (
    Math.sign(shown) *
    inverseRubberBand(Math.min(Math.abs(shown), PAD_BAND * 0.999), PAD_BAND)
  );
};

const unbandZoom = (zoom: number): number => {
  const shown = zoom < 1 ? zoom : 1 / zoom;
  const ratio = (3 - 0.5 / Math.max(shown - 0.5, 1e-9)) / 2;
  const excess = -Math.log(Math.min(Math.max(ratio, 1e-9), 1));
  return zoom < 1 ? -excess : excess;
};

const absorb = (held: number, step: number): [number, number] => {
  if (held === 0 || Math.sign(step) === Math.sign(held)) {
    return [held, step];
  }
  const left = held + step;
  return Math.sign(left) === Math.sign(held) ? [left, 0] : [0, left];
};

const settle = (value: number, noise: number): number =>
  Math.abs(value) < noise ? 0 : value;

const canPan = (state: CropState, delta: Point, scale: number): boolean => {
  const planes = panPlanes(
    imagePlanes(state),
    state.crop.width,
    state.crop.height
  );
  const step = 0.5 / scale;
  const x = -Math.sign(delta.x) * step;
  const y = -Math.sign(delta.y) * step;
  return [
    { x, y },
    { x, y: 0 },
    { x: 0, y },
  ].some(
    (move) =>
      (move.x !== 0 || move.y !== 0) &&
      insidePlanes(
        planes,
        { x: state.crop.x + move.x, y: state.crop.y + move.y },
        1e-9
      )
  );
};

const wheelDelta = (
  event: WheelEvent,
  page: number,
  sideways = event.shiftKey
): Point => {
  let unit = 1;
  if (event.deltaMode === 1) {
    unit = LINE_HEIGHT;
  } else if (event.deltaMode === 2) {
    unit = page;
  }
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;
  return sideways && dx === 0 ? { x: -dy, y: 0 } : { x: -dx, y: -dy };
};

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
  let releaseCursor: (() => void) | null = null;
  let options = initial;
  let element: HTMLElement | null = null;
  const view: View = viewOf(cropper);
  const pointers = new Map<number, Point>();
  let origin: Point = { x: 0, y: 0 };
  let start: Start | null = null;
  let rotating = false;
  let safari: Start | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;
  let wheelOwned = false;
  let wheelZoom = 0;
  let wheelPad = false;
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

  const anchorTo = (target: HTMLElement): void => {
    const box = target.getBoundingClientRect();
    origin = {
      x: box.left + target.clientLeft,
      y: box.top + target.clientTop,
    };
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

  const zoomAnchor = (): Point => rectCentre() ?? { x: 0, y: 0 };

  const pan = (
    begin: Start,
    delta: Point,
    event: Event
  ): { moved: boolean; excess: Point } => {
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
      return { excess: { x: 0, y: 0 }, moved: false };
    }
    return {
      excess: {
        x: settle((desired.x - after.crop.x) * -begin.scale, PAN_NOISE),
        y: settle((desired.y - after.crop.y) * -begin.scale, PAN_NOISE),
      },
      moved: before !== after,
    };
  };

  const pinch = (
    begin: Start,
    centroid: Point,
    ratio: number,
    turnRaw: number,
    event: Event
  ): number => {
    const centre = rectCentre();
    if (!centre) {
      return 0;
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
    const wanted = 1 / largestFit(imagePlanes(begin.state), next.crop).scale;
    const max = cropper.getMaxZoom();
    if (wanted < 1) {
      return settle(Math.log(wanted), ZOOM_NOISE);
    }
    return wanted > max ? settle(Math.log(wanted / max), ZOOM_NOISE) : 0;
  };

  const finish = (id: number, event: Event): void => {
    if (!pointers.delete(id)) {
      return;
    }
    if (pointers.size > 0) {
      rebase();
      view.settleOverscroll();
      view.setOverscroll(view.overscroll());
      return;
    }
    start = null;
    releaseCursor?.();
    releaseCursor = null;
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
        event.button !== 0 ||
        pointers.size >= 2 ||
        !element ||
        !cropper.getCropState()
      ) {
        return;
      }
      if (pointers.size === 0) {
        anchorTo(element);
        if (!cropper.begin("pan", event, owner)) {
          return;
        }
      } else {
        cropper.begin("pinch", event, owner);
      }
      capture(element, event.pointerId);
      if (pointers.size === 0) {
        releaseCursor = holdCursor(element);
      }
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
        const { excess } = pan(
          start,
          {
            x: centroid.x - start.centroid.x,
            y: centroid.y - start.centroid.y,
          },
          event
        );
        view.setOverscroll(
          rubberBandPoint(excess, { x: 0, y: 0 }, PAN_BAND, 1)
        );
        return;
      }
      const { distance, angle } = spread(points);
      const excess = pinch(
        start,
        centroid,
        distance / start.distance,
        wrapDegrees(angle - start.angle),
        event
      );
      view.setOverscroll(null, bandZoom(excess), zoomAnchor());
    },
    onPointerUp(event) {
      finish(event.pointerId, event);
    },
  };

  const endWheel = (): void => {
    if (wheelTimer !== null) {
      clearTimeout(wheelTimer);
    }
    wheelTimer = null;
    wheelZoom = 0;
    if (wheelOwned) {
      wheelOwned = false;
      view.settleOverscroll(wheelPad);
      cropper.end(undefined, owner);
    }
    wheelPad = false;
  };

  const idleWheel = (): void => {
    if (wheelTimer !== null) {
      clearTimeout(wheelTimer);
    }
    wheelTimer = setTimeout(endWheel, WHEEL_IDLE);
  };

  const wheelIgnored = (pinching: boolean, zoom: boolean): boolean =>
    (pinching && safari !== null) ||
    (!zoom && options.wheel === "none") ||
    cropper.getState().disabled;

  const claimWheel = (event: WheelEvent): boolean => {
    if (!cropper.begin("wheel", event, owner)) {
      return false;
    }
    wheelOwned = true;
    wheelPad = event.ctrlKey && !Number.isInteger(event.deltaY);
    wheelZoom = wheelPad
      ? unpadZoom(view.overzoom())
      : unbandZoom(view.overzoom());
    return true;
  };

  const wheelZoomBy = (begin: Start, event: WheelEvent, page: number): void => {
    const raw = -wheelDelta(event, page, false).y;
    const pinchStep = event.ctrlKey && !Number.isInteger(event.deltaY);
    const step = pinchStep ? raw : Math.min(Math.max(raw, -50), 50);
    if (pinchStep && !wheelPad) {
      wheelPad = true;
      wheelZoom = unpadZoom(view.overzoom());
    }
    const [held, rest] = absorb(wheelZoom, -step / 100);
    wheelZoom = held;
    if (rest !== 0) {
      wheelZoom += pinch(begin, begin.centroid, Math.exp(rest), 0, event);
    }
    const reach = wheelPad ? PAD_REACH : ZOOM_REACH;
    wheelZoom = Math.min(Math.max(wheelZoom, -reach), reach);
    view.setOverscroll(
      null,
      wheelPad ? padZoom(wheelZoom) : bandZoom(wheelZoom),
      zoomAnchor()
    );
  };

  const onWheel = (event: WheelEvent): void => {
    const state = cropper.getCropState();
    const frame = view.frame();
    if (!element || pointers.size > 0 || !state || !frame) {
      return;
    }
    const zoom = event.ctrlKey || options.wheel === "zoom";
    if (zoom) {
      event.preventDefault();
    }
    if (wheelIgnored(event.ctrlKey, zoom)) {
      return;
    }
    const delta = wheelDelta(event, element.clientHeight);
    if (delta.x === 0 && delta.y === 0) {
      if (event.ctrlKey) {
        endWheel();
      }
      return;
    }
    if (!wheelOwned) {
      const pageOwns = wheelTimer !== null && !zoom;
      if (pageOwns || (!zoom && !canPan(state, delta, frame.scale))) {
        idleWheel();
        return;
      }
      if (!claimWheel(event)) {
        return;
      }
    }
    idleWheel();
    event.preventDefault();
    anchorTo(element);
    const begin: Start = {
      angle: 0,
      centroid: local(event),
      distance: 1,
      scale: frame.scale,
      state,
    };
    if (zoom) {
      wheelZoomBy(begin, event, element.clientHeight);
    } else {
      pan(begin, delta, event);
    }
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
    anchorTo(element);
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
    const centroid = local(event);
    const excess = pinch(
      safari,
      centroid,
      event.scale || 1,
      event.rotation || 0,
      event
    );
    view.setOverscroll(null, padZoom(excess), zoomAnchor());
  };

  const onGestureEnd = (event: Event): void => {
    event.preventDefault();
    if (!safari) {
      return;
    }
    safari = null;
    view.settleOverscroll(true);
    cropper.end(event, owner);
  };

  const releaseAll = (event: Event): void => {
    for (const id of pointers.keys()) {
      finish(id, event);
    }
    if (safari) {
      safari = null;
      view.settleOverscroll(true);
      cropper.end(event, owner);
    }
    endWheel();
  };

  const onHidden = (): void => {
    if (document.visibilityState === "hidden") {
      releaseAll(new Event("visibilitychange"));
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
    releaseCursor?.();
    releaseCursor = null;
    view.setOverscroll({ x: 0, y: 0 }, 1);
    cropper.cancel(event, owner);
  };

  const onBlur = (event: Event): void => {
    releaseAll(event);
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
    releaseAll(new Event("lostpointercapture"));
    element = null;
  };

  return {
    destroy() {
      detach();
      endWheel();
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
      if (getComputedStyle(next).position === "static") {
        next.style.position = "relative";
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
  const offPointers = bindPointers(element, controller.handlers);
  controller.setElement(element);
  return () => {
    offPointers();
    controller.destroy();
  };
};
