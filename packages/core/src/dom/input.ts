import { largestFit } from "../geometry/coverage";
import { insidePlanes, panPlanes } from "../geometry/planes";
import type { Crop, HalfPlane } from "../geometry/types";

export const MIN_HANDLE_SPAN = 88;

export const stopAtZoomCeiling = (
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

export interface PointerHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onLostPointerCapture: (event: PointerEvent) => void;
}

export const capture = (element: Element, id: number): void => {
  try {
    element.setPointerCapture(id);
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
};

export const targetOf = (
  event: Event,
  element?: () => Element | null
): Element | null =>
  element?.() ??
  (event.currentTarget instanceof Element ? event.currentTarget : null);

export const bindPointers = (
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
