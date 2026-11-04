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
import {
  bindPointers,
  capture,
  claim,
  claimTouch,
  claimed,
  isElement,
  outside,
  pressLost,
  presses,
  watchLoss,
  windowOf,
} from "./input";
import type { PointerHandlers } from "./input";
import { localOf, viewOf } from "./view";
import type { Layout, View } from "./view";

type WheelMode = "pan" | "zoom" | "none";

type ViewportOptions = {
  wheel?: WheelMode | undefined;
  rotateGesture?: boolean | undefined;
};

type ViewportHandlers = PointerHandlers;

type ViewportController = {
  handlers: ViewportHandlers;
  setElement: (element: HTMLElement | null) => void;
  setOptions: (options: ViewportOptions) => void;
  destroy: () => void;
};

type SafariGestureEvent = UIEvent & {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
};

type Start = {
  state: CropState;
  scale: number;
  centroid: Point;
  distance: number;
  angle: number;
};

const PAN_BAND = 125;
const ZOOM_NOISE = 1e-6;
const ZOOM_REACH = 2;
const PAD_BAND = 0.08;
const PAD_REACH = 0.5;
const PAN_NOISE = 0.01;
const ROTATE_DEAD_ZONE = 5;
const WHEEL_IDLE_MS = 150;
const LINE_HEIGHT = 16;
const CONTROLS =
  "a[href],button,input,label,select,summary,textarea,[contenteditable],[role=button],[role=link],[role=menuitem],[role=option],[role=slider],[role=switch],[role=tab]";

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

const clientPoint = (event: { clientX: number; clientY: number }): Point => ({
  x: event.clientX,
  y: event.clientY,
});

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

const snapNoise = (value: number, noise: number): number =>
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

const padStep = (event: WheelEvent): boolean => {
  const physical =
    event.deltaY * ((event.view ?? globalThis).devicePixelRatio || 1);

  return event.ctrlKey && Math.abs(physical - Math.round(physical)) > 1e-3;
};

const notPhoto = (event: Event, element: Element): boolean => {
  const path = event.composedPath();
  const at = path.indexOf(element);

  return (
    outside(element, event) ||
    path
      .slice(0, Math.max(at, 0))
      .some((node) => isElement(node) && node.matches(CONTROLS))
  );
};

const isPointer = (event: Event): event is PointerEvent => "pointerId" in event;

const isGesture = (event: Event): event is SafariGestureEvent =>
  "scale" in event && "rotation" in event;

const wrapDegrees = (degrees: number): number =>
  ((((degrees + 180) % 360) + 360) % 360) - 180;

const transformAround = (
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

const viewportController = (
  cropper: Cropper,
  initial: ViewportOptions = {}
): ViewportController => {
  const owner = {};
  let releaseCursor: (() => void) | null = null;
  let options = initial;
  let element: HTMLElement | null = null;
  const view: View = viewOf(cropper);
  const pointers = new Map<number, Point>();
  let local = clientPoint;
  let start: Start | null = null;
  let twist = 0;
  let safari: Start | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | null = null;
  let wheelOwned = false;
  let wheelZoom = 0;
  let wheelPad = false;
  let observers: ResizeObserver[] = [];
  let win: typeof globalThis = globalThis;
  let positioned = false;
  let unclaim: (() => void) | null = null;
  let dprQuery: MediaQueryList | null = null;
  let unwatch: (() => void) | null = null;

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

    twist = 0;
  };

  const measure = (): void => {
    if (!element) {
      return;
    }

    const style = getComputedStyle(element);

    if (style.position === "static") {
      element.style.position = "relative";
      positioned = true;
    }

    const layout: Layout = {
      dpr: win.devicePixelRatio || 1,
      height: element.clientHeight,
      inset: {
        bottom: pixels(style.paddingBottom),
        left: pixels(style.paddingLeft),
        right: pixels(style.paddingRight),
        top: pixels(style.paddingTop),
      },
      width: element.clientWidth,
    };

    view.setLayout(
      layout.width > 0 && layout.height > 0 ? layout : null,
      element
    );

    if (view.frame()?.scale !== start?.scale) {
      rebase();
    }
  };

  const onDpr = (): void => {
    dprQuery?.removeEventListener("change", onDpr);

    dprQuery =
      win.matchMedia?.(`(resolution: ${win.devicePixelRatio || 1}dppx)`) ??
      null;

    dprQuery?.addEventListener("change", onDpr);
    measure();
  };

  const onAncestorSettle = (event: Event): void => {
    if (element && isElement(event.target) && event.target.contains(element)) {
      measure();
    }
  };

  const anchorTo = (target: HTMLElement): void => {
    local = localOf(target);
  };

  const rectCentre = (): Point | null => {
    const rect = view.frame()?.rect;

    return rect
      ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      : null;
  };

  const offsetOf = (begin: Start): Point => {
    const centre = rectCentre();

    return centre
      ? {
          x: centre.x - begin.scale * begin.state.crop.x,
          y: centre.y - begin.scale * begin.state.crop.y,
        }
      : { x: 0, y: 0 };
  };

  const zoomAnchor = (): Point => rectCentre() ?? { x: 0, y: 0 };

  const pan = (
    begin: Start,
    delta: Point,
    event?: Event
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

    if (!after || cropper.getState().disabled) {
      return { excess: { x: 0, y: 0 }, moved: false };
    }

    return {
      excess: {
        x: snapNoise((desired.x - after.crop.x) * -begin.scale, PAN_NOISE),
        y: snapNoise((desired.y - after.crop.y) * -begin.scale, PAN_NOISE),
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

    if (!centre || cropper.getState().disabled) {
      return 0;
    }

    const turn =
      options.rotateGesture === false
        ? 0
        : Math.sign(turnRaw) *
          Math.max(Math.abs(turnRaw) - ROTATE_DEAD_ZONE, 0);
    const { crop } = begin.state;
    const from = 1 / largestFit(imagePlanes(begin.state), crop).scale;
    const min = cropper.getMinSize();
    const max = cropper.getMaxZoom();
    const wanted = from * ratio;
    const ceiling = Math.max(
      Math.min(
        max,
        from * Math.min(crop.width / min.width, crop.height / min.height)
      ),
      from
    );
    const next = transformAround(
      begin.state,
      begin.scale,
      centre,
      begin.centroid,
      centroid,
      Math.min(Math.max(wanted, 1), ceiling) / from,
      turn,
      offsetOf(begin)
    );

    cropper.setCropState(next, {
      event,
      keep: turn === 0 ? "size" : "centre",
      reason: cropper.getState().interacting ?? "pinch",
    });

    if (wanted < 1) {
      return snapNoise(Math.log(wanted), ZOOM_NOISE);
    }

    return wanted > max ? snapNoise(Math.log(wanted / max), ZOOM_NOISE) : 0;
  };

  const backStart = (by: Point, raw: number): void => {
    if (start) {
      start = {
        ...start,
        centroid: {
          x: start.centroid.x - by.x * raw,
          y: start.centroid.y - by.y * raw,
        },
      };
    }
  };

  const finish = (id: number, event?: Event): void => {
    if (!pointers.delete(id)) {
      return;
    }

    if (pointers.size > 0) {
      rebase();

      if (!start) {
        view.settleOverscroll();

        return;
      }

      const held = view.overscroll();

      view.settleZoom();
      const { excess } = pan(start, held, event);
      const length = Math.hypot(excess.x, excess.y);

      view.setOverscroll(excess);
      rebase();

      if (length > 0) {
        backStart(excess, inverseRubberBand(length, PAN_BAND, 1) / length);
      }

      return;
    }

    start = null;
    releaseCursor?.();
    releaseCursor = null;
    view.settleOverscroll();
    cropper.end(event, owner);
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

  const handlers: ViewportHandlers = {
    onLostPointerCapture(event) {
      finish(event.pointerId, event);
    },
    onPointerCancel(event) {
      finish(event.pointerId, event);
    },
    onPointerDown(event) {
      const taken = claimed(event);

      claim(event);

      if (
        taken ||
        !presses(event) ||
        pointers.size >= 2 ||
        !element ||
        !cropper.getCropState() ||
        notPhoto(event, element)
      ) {
        return;
      }

      if (pointers.size === 0) {
        if (wheelOwned) {
          endWheel();
        }

        anchorTo(element);

        if (!cropper.begin("pan", event, owner)) {
          return;
        }
      } else {
        cropper.begin("pinch", event, owner);
      }

      safari = null;
      capture(element, event.pointerId);

      if (pointers.size === 0 && event.pointerType !== "touch") {
        releaseCursor = holdCursor(element);
      }

      pointers.set(event.pointerId, local(event));
      rebase();
    },
    onPointerMove(event) {
      if (!pointers.has(event.pointerId)) {
        return;
      }

      if (pressLost(event, element)) {
        finish(event.pointerId, event);

        return;
      }

      if (cropper.rebase(owner)) {
        rebase();
      }

      if (!start) {
        return;
      }

      const samples = event.getCoalescedEvents?.() ?? [];
      const last = samples.at(-1) ?? event;

      pointers.set(event.pointerId, local(last));
      const points = [...pointers.values()];
      const centroid = centroidOf(points);

      if (points.length === 1) {
        cropper.begin("pan", event, owner);
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

      twist += wrapDegrees(angle - start.angle);
      start.angle = angle;
      const excess = pinch(
        start,
        centroid,
        distance / start.distance,
        twist,
        event
      );

      view.setOverscroll(null, bandZoom(excess), zoomAnchor());
    },
    onPointerUp(event) {
      finish(event.pointerId, event);
    },
  };

  const idleWheel = (): void => {
    if (wheelTimer !== null) {
      clearTimeout(wheelTimer);
    }

    wheelTimer = setTimeout(endWheel, WHEEL_IDLE_MS);
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
    wheelPad = padStep(event);

    wheelZoom = wheelPad
      ? unpadZoom(view.overzoom())
      : unbandZoom(view.overzoom());

    return true;
  };

  const wheelZoomBy = (begin: Start, event: WheelEvent, page: number): void => {
    const raw = -wheelDelta(event, page, false).y;
    const pinchStep = padStep(event);
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

  const wheelZooms = (event: WheelEvent): boolean =>
    event.ctrlKey || (options.wheel === "zoom" && !cropper.getState().disabled);

  const leavesWheel = (event: WheelEvent, zoom: boolean): boolean =>
    zoom && !event.ctrlKey && !wheelOwned && event.deltaY === 0;

  const onWheel = (event: WheelEvent): void => {
    const state = cropper.getCropState();
    const frame = view.frame();

    if (!element || !state || !frame) {
      return;
    }

    const zoom = wheelZooms(event);

    if (leavesWheel(event, zoom)) {
      return;
    }

    if (zoom) {
      event.preventDefault();
    }

    if (pointers.size > 0 || wheelIgnored(event.ctrlKey, zoom)) {
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
      if (
        !zoom &&
        (wheelTimer !== null || !canPan(state, delta, frame.scale))
      ) {
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

  const inert = (): boolean =>
    safari === null && (!cropper.getCropState() || cropper.getState().disabled);

  const endSafari = (event?: Event): void => {
    if (safari) {
      safari = null;
      view.settleOverscroll(true);
      cropper.end(event, owner);
    }
  };

  const safariStart = (
    event: SafariGestureEvent,
    scale: number
  ): Start | null => {
    const state = cropper.getCropState();

    return state
      ? {
          angle: event.rotation || 0,
          centroid: local(event),
          distance: event.scale || 1,
          scale,
          state,
        }
      : null;
  };

  const onGestureStart = (event: Event): void => {
    if (inert()) {
      return;
    }

    event.preventDefault();
    const frame = view.frame();

    if (pointers.size > 0 || !element || !frame || !isGesture(event)) {
      return;
    }

    if (wheelOwned) {
      endWheel();
    }

    anchorTo(element);

    if (cropper.begin("pinch", event, owner)) {
      safari = safariStart(event, frame.scale);
    }
  };

  const onGestureChange = (event: Event): void => {
    if (inert()) {
      return;
    }

    event.preventDefault();

    if (!safari || !isGesture(event)) {
      return;
    }

    const frame = view.frame();

    if (cropper.rebase(owner) && frame) {
      safari = safariStart(event, frame.scale) ?? safari;
    }

    if (!cropper.getCropState()) {
      return;
    }

    const excess = pinch(
      safari,
      local(event),
      (event.scale || 1) / safari.distance,
      (event.rotation || 0) - safari.angle,
      event
    );

    view.setOverscroll(null, padZoom(excess), zoomAnchor());
  };

  const onGestureEnd = (event: Event): void => {
    if (inert()) {
      return;
    }

    event.preventDefault();
    endSafari(event);
  };

  const releaseAll = (event?: Event): void => {
    for (const id of pointers.keys()) {
      finish(id, event);
    }

    endSafari(event);
    endWheel();
  };

  const onLoss = (event?: Event): void => {
    if (event && isPointer(event)) {
      finish(event.pointerId, event);
    } else {
      releaseAll(event);
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
    cropper.rebase(owner);
    cropper.cancel(event, owner);
  };

  const detach = (): void => {
    if (!element) {
      return;
    }

    for (const observer of observers) {
      observer.disconnect();
    }

    observers = [];
    dprQuery?.removeEventListener("change", onDpr);
    dprQuery = null;
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("gesturestart", onGestureStart);
    element.removeEventListener("gesturechange", onGestureChange);
    element.removeEventListener("gestureend", onGestureEnd);
    win.document.removeEventListener("transitionend", onAncestorSettle, true);
    win.document.removeEventListener("animationend", onAncestorSettle, true);
    unwatch?.();
    unwatch = null;
    win.removeEventListener("keydown", onEscape, true);
    releaseAll(new Event("lostpointercapture"));
    view.setLayout(null, element);
    unclaim?.();
    unclaim = null;

    if (positioned) {
      element.style.position = "";
      positioned = false;
    }

    element = null;
  };

  return {
    destroy() {
      detach();
    },
    handlers,
    setElement(next) {
      if (next === element) {
        return;
      }

      detach();
      element = next;

      if (!next) {
        return;
      }

      win = windowOf(next);
      unclaim = claimTouch(next, "none");
      next.addEventListener("wheel", onWheel, { passive: false });
      next.addEventListener("gesturestart", onGestureStart);
      next.addEventListener("gesturechange", onGestureChange);
      next.addEventListener("gestureend", onGestureEnd);
      win.document.addEventListener("transitionend", onAncestorSettle, true);
      win.document.addEventListener("animationend", onAncestorSettle, true);
      unwatch = watchLoss(cropper, onLoss, (id) => pointers.has(id), next);
      win.addEventListener("keydown", onEscape, true);

      observers = (["content-box", "border-box"] as const).map((box) => {
        const observer = new win.ResizeObserver(measure);

        observer.observe(next, { box });

        return observer;
      });

      onDpr();
    },
    setOptions(next) {
      options = next;
    },
  };
};

const bindViewport = (
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

export type {
  ViewportController,
  ViewportHandlers,
  ViewportOptions,
  WheelMode,
};
export { bindViewport, viewportController };
