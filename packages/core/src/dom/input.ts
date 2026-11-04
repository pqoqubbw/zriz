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
