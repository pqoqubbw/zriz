import type { Cropper } from "../cropper";
import { largestFit } from "../geometry/coverage";
import { insidePlanes, panPlanes } from "../geometry/planes";
import type { Crop, HalfPlane } from "../geometry/types";
import { noop } from "./turn";

type PointerHandlers = {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onLostPointerCapture: (event: PointerEvent) => void;
};

const MIN_HANDLE_SPAN = 88;

const TOUCH_STYLES = [
  ["user-select", "none"],
  ["-webkit-user-select", "none"],
  ["-webkit-touch-callout", "none"],
  ["-webkit-tap-highlight-color", "transparent"],
] as const;

const stopAtZoomCeiling = (
  planes: readonly HalfPlane[],
  from: Crop,
  to: Crop,
  maxZoom: number,
  locked = false
): Crop => {
  const at = (x: number, y: number): Crop => ({
    height: from.height + y * (to.height - from.height),
    width: from.width + x * (to.width - from.width),
    x: from.x + x * (to.x - from.x),
    y: from.y + y * (to.y - from.y),
  });
  const allowed = (crop: Crop): boolean =>
    largestFit(planes, crop).scale * maxZoom >= 1 &&
    insidePlanes(panPlanes(planes, crop.width, crop.height), crop, 1e-9);

  if (allowed(to)) {
    return to;
  }

  const reach = (crop: (share: number) => Crop): number => {
    let low = 0;
    let high = 1;

    for (let step = 0; step < 30; step += 1) {
      const middle = (low + high) / 2;

      if (allowed(crop(middle))) {
        low = middle;
      } else {
        high = middle;
      }
    }

    return low;
  };

  if (locked) {
    const share = reach((s) => at(s, s));

    return at(share, share);
  }

  const x1 = reach((s) => at(s, 0));
  const xFirst = at(
    x1,
    reach((s) => at(x1, s))
  );
  const y2 = reach((s) => at(0, s));
  const yFirst = at(
    reach((s) => at(s, y2)),
    y2
  );
  const missed = (crop: Crop): number =>
    Math.abs(crop.width - to.width) + Math.abs(crop.height - to.height);

  return missed(xFirst) < missed(yFirst) ? xFirst : yFirst;
};

const capture = (element: Element, id: number): void => {
  try {
    element.setPointerCapture(id);
  } catch {
    noop();
  }
};

const isElement = (node: EventTarget | null): node is Element =>
  node !== null && "matches" in node;

const windowOf = (element?: Element | null): typeof globalThis =>
  element?.ownerDocument.defaultView ?? globalThis;

const claimTouch = ({ style }: HTMLElement, touch: string): (() => void) => {
  style.touchAction = touch;

  for (const [name, value] of TOUCH_STYLES) {
    style.setProperty(name, value);
  }

  return () => {
    style.touchAction = "";

    for (const [name] of TOUCH_STYLES) {
      style.removeProperty(name);
    }
  };
};

const targetOf = (
  event: Event,
  element?: () => Element | null
): Element | null =>
  element?.() ?? (isElement(event.currentTarget) ? event.currentTarget : null);

const claims = new WeakSet<Event>();

const claim = (event: Event): void => {
  claims.add(event);
};

const claimed = (event: Event): boolean => claims.has(event);

const presses = (event: PointerEvent): boolean =>
  event.button === 0 && !(event.ctrlKey && /mac/iu.test(navigator.platform));

const pressLost = (
  event: PointerEvent,
  element: Element | null | undefined
): boolean =>
  (event.pointerType === "mouse" && event.buttons === 0) ||
  element?.getClientRects().length === 0;

const closedRoot = (node: Node): node is ShadowRoot =>
  "mode" in node && node.mode === "closed";

const within = (node: Element, path: EventTarget[]): boolean => {
  const root = node.getRootNode();

  return path.includes(node) || (closedRoot(root) && within(root.host, path));
};

const outside = (element: Element | null, event: Event): boolean =>
  event.target !== null &&
  (element === null || !within(element, event.composedPath()));

const watchLoss = (
  cropper: Cropper,
  lost: (event?: Event) => void,
  held: (id: number) => boolean,
  element: Element | null
): (() => void) => {
  const win = windowOf(element);
  const doc = win.document;

  const onHidden = (event: Event): void => {
    if (doc.visibilityState === "hidden") {
      lost(event);
    }
  };

  const onPointer = (event: PointerEvent): void => {
    if (held(event.pointerId) && outside(element, event)) {
      lost(event);
    }
  };

  const onStop = (): void => {
    lost();
  };

  const offStop = cropper.on("stop", onStop);
  const offDestroy = cropper.on("destroy", onStop);

  doc.addEventListener("visibilitychange", onHidden);
  win.addEventListener("blur", lost);
  win.addEventListener("pointerup", onPointer, true);
  win.addEventListener("pointercancel", onPointer, true);

  return () => {
    offStop();
    offDestroy();
    doc.removeEventListener("visibilitychange", onHidden);
    win.removeEventListener("blur", lost);
    win.removeEventListener("pointerup", onPointer, true);
    win.removeEventListener("pointercancel", onPointer, true);
  };
};

const watchEscape = (
  element: Element | null,
  cancel: (event: KeyboardEvent) => void
): (() => void) => {
  const win = windowOf(element);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel(event);
    }
  };

  win.addEventListener("keydown", onKey, true);

  return () => {
    win.removeEventListener("keydown", onKey, true);
  };
};

const bindPointers = (
  element: HTMLElement,
  handlers: PointerHandlers
): (() => void) => {
  const events = [
    ["pointerdown", handlers.onPointerDown],
    ["pointermove", handlers.onPointerMove],
    ["pointerup", handlers.onPointerUp],
    ["pointercancel", handlers.onPointerCancel],
    ["lostpointercapture", handlers.onLostPointerCapture],
  ] as const;

  for (const [type, handler] of events) {
    element.addEventListener(type, handler);
  }

  return () => {
    for (const [type, handler] of events) {
      element.removeEventListener(type, handler);
    }
  };
};

export type { PointerHandlers };
export {
  MIN_HANDLE_SPAN,
  bindPointers,
  capture,
  claim,
  claimTouch,
  claimed,
  isElement,
  outside,
  pressLost,
  presses,
  stopAtZoomCeiling,
  targetOf,
  watchEscape,
  watchLoss,
  windowOf,
};
