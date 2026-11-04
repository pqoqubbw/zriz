import { MAX_ZOOM } from "../cropper";
import type { Cropper } from "../cropper";
import { minScaleAt } from "../geometry/coverage";
import { imagePlanes, panPlanes } from "../geometry/planes";
import { holdCursor } from "./cursor";
import {
  MIN_HANDLE_SPAN,
  capture,
  claim,
  pressLost,
  presses,
  stopAtZoomCeiling,
  targetOf,
  watchLoss,
} from "./input";
import type { PointerHandlers } from "./input";
import { keyed, numberFormat, sliderAria, sliderKey } from "./slider";
import type { KeyHandlers } from "./slider";
import { viewOf } from "./view";

export type ZoomHandlers = KeyHandlers & PointerHandlers;

export type ZoomOptions = {
  max?: number | undefined;
  dir?: "ltr" | "rtl" | undefined;
  locale?: string | undefined;
  format?: Intl.NumberFormatOptions | undefined;
};

const KEY_STEPS = 20;
const ZOOM_KEY_FACTOR = 1.1;
const ARROWS: Partial<Record<string, readonly [number, number]>> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

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
    const arrow = ARROWS[event.key];

    if (arrow && event.altKey) {
      const grow = (1 + step) ** (arrow[0] + arrow[1]);

      return () => {
        const { crop } = state;
        let next = {
          ...crop,
          height: crop.height * grow,
          width: crop.width * grow,
        };

        if (state.aspect === null) {
          const side = arrow[0] === 0 ? "height" : "width";
          const length = crop[side];
          const planes = imagePlanes(state);
          const held = { ...crop, [side]: 0 };
          const room =
            1 /
            minScaleAt(
              panPlanes(planes, held.width, held.height),
              { height: held.height ? 0 : 1, width: held.width ? 0 : 1 },
              crop
            );
          const floor =
            MIN_HANDLE_SPAN /
            (viewOf(cropper).frame()?.scale ?? Number.POSITIVE_INFINITY);

          next = stopAtZoomCeiling(
            planes,
            crop,
            {
              ...crop,
              [side]: Math.min(
                Math.max(length * grow, Math.min(length, floor)),
                Math.max(length, room)
              ),
            },
            cropper.getMaxZoom()
          );
        }

        cropper.setCropState(
          { ...state, crop: next },
          { ...action, keep: "centre" }
        );
      };
    }

    if (event.altKey) {
      return null;
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
  options: ZoomOptions | (() => ZoomOptions) = {},
  element?: () => Element | null
): ZoomHandlers => {
  const owner = {};
  let pointer: number | null = null;
  let unwatch: (() => void) | null = null;
  let releaseCursor: (() => void) | null = null;
  const read = (): ZoomOptions =>
    typeof options === "function" ? options() : options;
  const max = (): number => read().max ?? cropper.getMaxZoom();
  const sign = (): number => (read().dir === "rtl" ? -1 : 1);

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

  const lost = (event?: Event): void => {
    if (pointer !== null) {
      pointer = null;
      unwatch?.();
      unwatch = null;
      releaseCursor?.();
      releaseCursor = null;
      cropper.end(event, owner);
    }
  };

  const finish = (event: PointerEvent): void => {
    if (pointer === event.pointerId) {
      lost(event);
    }
  };

  const keys = keyed(cropper, (event) => {
    if (event.altKey) {
      return null;
    }

    const top = max();
    const zoom = cropper.getZoom();
    const next = sliderKey(
      event,
      zoomProgress(zoom, top),
      KEY_STEPS,
      0,
      1,
      sign()
    );

    if (next === undefined) {
      return null;
    }

    const past =
      event.key === "Home" || event.key === "End" ? 1 : Math.max(zoom / top, 1);

    return () => {
      cropper.setZoom(zoomAt(next, top) * past, {
        event,
        reason: "zoom-control",
      });
    };
  });

  return {
    ...keys,
    onLostPointerCapture: finish,
    onPointerCancel: finish,
    onPointerDown(event) {
      claim(event);

      if (
        pointer !== null ||
        !presses(event) ||
        !cropper.getCropState() ||
        !cropper.begin("zoom-control", event, owner)
      ) {
        return;
      }

      pointer = event.pointerId;
      const own = targetOf(event, element);

      unwatch = watchLoss(cropper, lost, (id) => id === pointer, own);

      if (own) {
        capture(own, event.pointerId);
        releaseCursor = holdCursor(own);
      }

      fromPointer(event);
    },
    onPointerMove(event) {
      if (pointer !== event.pointerId) {
        return;
      }

      if (pressLost(event, targetOf(event, element))) {
        lost(event);
      } else {
        fromPointer(event);
      }
    },
    onPointerUp: finish,
    release() {
      lost();
      keys.release();
    },
  };
};

export const zoomAria = (
  cropper: Cropper,
  element: HTMLElement,
  options: ZoomOptions = {}
): (() => void) => {
  const formatter = numberFormat(
    options.locale,
    { maximumFractionDigits: 0, style: "percent" },
    options.format
  );

  return sliderAria(cropper, element, "zoom-control", () => {
    const zoom = cropper.getZoom();
    const top = options.max ?? cropper.getMaxZoom();

    return [
      1,
      top,
      Math.round(Math.min(zoom, top) * 100) / 100,
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
    const next = `${Math.round(progress * 1e5) / 1e3}%`;

    if (next !== last) {
      last = next;
      element.style.insetInlineStart = next;
    }
  };

  write();

  return cropper.on("frame", write);
};
