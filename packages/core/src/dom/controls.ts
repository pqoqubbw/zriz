import type { Cropper } from "../cropper";
import { capture } from "./view";

export interface KeyHandlers {
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
}

export interface ZoomHandlers extends KeyHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onLostPointerCapture: (event: PointerEvent) => void;
}

export interface ZoomOptions {
  max?: number | undefined;
  dir?: "ltr" | "rtl" | undefined;
  locale?: string | undefined;
  format?: Intl.NumberFormatOptions | undefined;
}

const MAX_ZOOM = 15;
const KEY_STEPS = 20;
const ZOOM_KEY_FACTOR = 1.1;

export const zoomProgress = (zoom: number, max: number = MAX_ZOOM): number =>
  max <= 1 ? 0 : Math.min(Math.max(Math.log(zoom) / Math.log(max), 0), 1);

export const zoomAt = (progress: number, max: number = MAX_ZOOM): number =>
  max ** Math.min(Math.max(progress, 0), 1);

type KeyAction = (() => void) | null;

const keyed = (
  cropper: Cropper,
  plan: (event: KeyboardEvent) => KeyAction
): KeyHandlers => {
  let active = false;
  return {
    onKeyDown(event) {
      const run = plan(event);
      if (!run || (!active && !cropper.begin("keyboard", event))) {
        return;
      }
      event.preventDefault();
      active = true;
      run();
    },
    onKeyUp(event) {
      if (active) {
        active = false;
        cropper.end(event);
      }
    },
  };
};

export const areaKeyHandlers = (cropper: Cropper): KeyHandlers =>
  keyed(cropper, (event) => {
    const state = cropper.getCropState();
    if (!state) {
      return null;
    }
    const step = event.shiftKey ? 0.1 : 0.01;
    const { size } = cropper.getValue();
    const action = { event, reason: "keyboard" as const };
    const arrows: Partial<Record<string, [number, number]>> = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
    };
    const arrow = arrows[event.key];
    if (arrow && event.altKey) {
      const grow = 1 + step;
      const width = arrow[0] === 0 ? 1 : grow ** arrow[0];
      const height = arrow[1] === 0 ? 1 : grow ** arrow[1];
      const lock = state.aspect === null ? 1 : Math.max(width, height);
      return () => {
        cropper.setCropState(
          {
            ...state,
            crop: {
              ...state.crop,
              height:
                state.crop.height * (state.aspect === null ? height : lock),
              width: state.crop.width * (state.aspect === null ? width : lock),
            },
          },
          { ...action, keep: "centre" }
        );
      };
    }
    if (arrow) {
      return () => {
        cropper.panBy(
          arrow[0] * step * size.width,
          arrow[1] * step * size.height,
          action
        );
      };
    }
    if (event.key === "+" || event.key === "=") {
      return () => {
        cropper.setZoom(cropper.getZoom() * ZOOM_KEY_FACTOR, action);
      };
    }
    if (event.key === "-" || event.key === "_") {
      return () => {
        cropper.setZoom(cropper.getZoom() / ZOOM_KEY_FACTOR, action);
      };
    }
    if (event.key === "0") {
      return () => {
        cropper.reset(action);
      };
    }
    return null;
  });

export const zoomHandlers = (
  cropper: Cropper,
  options: ZoomOptions = {},
  element?: () => Element | null
): ZoomHandlers => {
  let pointer: number | null = null;
  const max = (): number => options.max ?? MAX_ZOOM;
  const sign = (): number => (options.dir === "rtl" ? -1 : 1);
  const target = (event: Event): Element | null =>
    element?.() ??
    (event.currentTarget instanceof Element ? event.currentTarget : null);
  const fromPointer = (event: PointerEvent): void => {
    const box = target(event)?.getBoundingClientRect();
    if (!box || box.width === 0) {
      return;
    }
    let progress = (event.clientX - box.left) / box.width;
    if (sign() < 0) {
      progress = 1 - progress;
    }
    cropper.setZoom(zoomAt(progress, max()), {
      event,
      reason: "zoom-control",
    });
  };
  const finish = (event: PointerEvent): void => {
    if (pointer === event.pointerId) {
      pointer = null;
      cropper.end(event);
    }
  };
  const keys = keyed(cropper, (event) => {
    const progress = zoomProgress(cropper.getZoom(), max());
    const step = (event.shiftKey ? 10 : 1) / KEY_STEPS;
    const moves: Partial<Record<string, number>> = {
      ArrowDown: progress - step,
      ArrowLeft: progress - step * sign(),
      ArrowRight: progress + step * sign(),
      ArrowUp: progress + step,
      End: 1,
      Home: 0,
      PageDown: progress - 10 / KEY_STEPS,
      PageUp: progress + 10 / KEY_STEPS,
    };
    const next = moves[event.key];
    if (next === undefined) {
      return null;
    }
    return () => {
      cropper.setZoom(zoomAt(next, max()), { event, reason: "zoom-control" });
    };
  });
  return {
    ...keys,
    onLostPointerCapture: finish,
    onPointerCancel: finish,
    onPointerDown(event) {
      if (
        pointer !== null ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        !cropper.begin("zoom-control", event)
      ) {
        return;
      }
      pointer = event.pointerId;
      const own = target(event);
      if (own) {
        capture(own, event.pointerId);
      }
      fromPointer(event);
    },
    onPointerMove(event) {
      if (pointer === event.pointerId) {
        fromPointer(event);
      }
    },
    onPointerUp: finish,
  };
};

export const zoomAria = (
  cropper: Cropper,
  element: HTMLElement,
  options: ZoomOptions = {}
): (() => void) => {
  const formatter = new Intl.NumberFormat(options.locale, {
    maximumFractionDigits: 0,
    style: "percent",
    ...options.format,
  });
  const aria = (): void => {
    const zoom = cropper.getZoom();
    element.setAttribute("aria-valuemin", "1");
    element.setAttribute("aria-valuemax", String(options.max ?? MAX_ZOOM));
    element.setAttribute("aria-valuenow", String(Math.round(zoom * 100) / 100));
    element.setAttribute("aria-valuetext", formatter.format(zoom));
  };
  aria();
  const offCommit = cropper.on("commit", aria);
  const offKeys = cropper.on("change", (_, details) => {
    if (details.reason === "keyboard" || details.reason === "zoom-control") {
      aria();
    }
  });
  return () => {
    offCommit();
    offKeys();
  };
};

export const bindZoomThumb = (
  cropper: Cropper,
  element: HTMLElement,
  options: ZoomOptions = {}
): (() => void) => {
  element.style.position = "absolute";
  let last = "";
  const write = (): void => {
    const progress = zoomProgress(cropper.getZoom(), options.max ?? MAX_ZOOM);
    const next = `${progress * 100}%`;
    if (next !== last) {
      last = next;
      element.style.insetInlineStart = next;
    }
  };
  write();
  return cropper.on("frame", write);
};
