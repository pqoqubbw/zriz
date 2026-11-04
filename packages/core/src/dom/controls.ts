import { MAX_ZOOM } from "../cropper";
import type { Cropper } from "../cropper";
import { capture, targetOf } from "./input";
import type { PointerHandlers } from "./input";
import { keyed, numberFormat, sliderAria, sliderKey } from "./slider";
import type { KeyHandlers } from "./slider";

export type ZoomHandlers = KeyHandlers & PointerHandlers;

export interface ZoomOptions {
  max?: number | undefined;
  dir?: "ltr" | "rtl" | undefined;
  locale?: string | undefined;
  format?: Intl.NumberFormatOptions | undefined;
}

const KEY_STEPS = 20;
const ZOOM_KEY_FACTOR = 1.1;

export const zoomProgress = (zoom: number, max: number = MAX_ZOOM): number =>
  max <= 1 ? 0 : Math.min(Math.max(Math.log(zoom) / Math.log(max), 0), 1);

export const zoomAt = (progress: number, max: number = MAX_ZOOM): number =>
  max ** Math.min(Math.max(progress, 0), 1);

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
      const lock = width * height;
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
  const owner = {};
  let pointer: number | null = null;
  const max = (): number => options.max ?? cropper.getMaxZoom();
  const sign = (): number => (options.dir === "rtl" ? -1 : 1);
  const fromPointer = (event: PointerEvent): void => {
    const box = targetOf(event, element)?.getBoundingClientRect();
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
      cropper.end(event, owner);
    }
  };
  const keys = keyed(cropper, (event) => {
    const next = sliderKey(
      event,
      zoomProgress(cropper.getZoom(), max()),
      KEY_STEPS,
      0,
      1,
      sign()
    );
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
        event.button !== 0 ||
        !cropper.begin("zoom-control", event, owner)
      ) {
        return;
      }
      pointer = event.pointerId;
      const own = targetOf(event, element);
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
  const formatter = numberFormat(options.locale, {
    maximumFractionDigits: 0,
    style: "percent",
    ...options.format,
  });
  return sliderAria(cropper, element, "zoom-control", () => {
    const zoom = cropper.getZoom();
    return [
      1,
      options.max ?? cropper.getMaxZoom(),
      Math.round(zoom * 100) / 100,
      formatter.format(zoom),
    ];
  });
};

export const bindZoomThumb = (
  cropper: Cropper,
  element: HTMLElement,
  options: ZoomOptions = {}
): (() => void) => {
  element.style.position = "absolute";
  let last = "";
  const write = (): void => {
    const progress = zoomProgress(
      cropper.getZoom(),
      options.max ?? cropper.getMaxZoom()
    );
    const next = `${progress * 100}%`;
    if (next !== last) {
      last = next;
      element.style.insetInlineStart = next;
    }
  };
  write();
  return cropper.on("frame", write);
};
