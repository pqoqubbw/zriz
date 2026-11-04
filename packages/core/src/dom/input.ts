import { largestFit } from "../geometry/coverage";
import type { Crop, HalfPlane } from "../geometry/types";

export const stopAtZoomCeiling = (
  planes: readonly HalfPlane[],
  from: Crop,
  to: Crop,
  maxZoom: number
): Crop => {
  const at = (share: number): Crop => ({
    height: from.height + share * (to.height - from.height),
    width: from.width + share * (to.width - from.width),
    x: from.x + share * (to.x - from.x),
    y: from.y + share * (to.y - from.y),
  });
  const under = (crop: Crop): boolean =>
    largestFit(planes, crop).scale * maxZoom >= 1;
  if (under(to)) {
    return to;
  }
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2;
    if (under(at(middle))) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return at(low);
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
