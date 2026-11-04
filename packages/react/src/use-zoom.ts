"use client";

import type { Cropper } from "@zriz/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useCropperState, useTarget } from "./use-cropper";

type UseZoom = {
  value: number;
  min: number;
  max: number;
  dragging: boolean;
  onValueChange: (zoom: number) => void;
  onValueCommitted: () => void;
};

const IDLE_MS = 150;

const PRESSES = ["pointerdown", "keydown"] as const;

const RELEASES = ["pointerup", "pointercancel", "keyup"] as const;

const heldBy = (event: PointerEvent | KeyboardEvent): number | string =>
  "key" in event ? event.key : event.pointerId;

const useZoom = (
  options: { max?: number | undefined; cropper?: Cropper | undefined } = {}
): UseZoom => {
  const cropper = useTarget(options.cropper);
  const subscribe = useCallback(
    (listener: () => void) => cropper.on("frame", listener),
    [cropper]
  );
  const limit = useSyncExternalStore(
    subscribe,
    cropper.getMaxZoom,
    cropper.getMaxZoom
  );
  const max = options.max ?? limit;
  const value = useSyncExternalStore(
    subscribe,
    () => Math.round(cropper.getZoom() * 1000) / 1000,
    () => 1
  );
  const dragging = useCropperState(
    (s) => s.interacting === "zoom-control",
    cropper
  );
  const [held] = useState(() => new Set<number | string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onValueCommitted = useCallback(() => {
    clearTimeout(timer.current);
    cropper.end(undefined, held);
  }, [cropper, held]);
  const onValueChange = useCallback(
    (zoom: number) => {
      if (cropper.getState().interacting === null) {
        cropper.begin("zoom-control", undefined, held);
      }

      cropper.setZoom(zoom, { reason: "zoom-control" });
      clearTimeout(timer.current);

      if (held.size === 0) {
        timer.current = setTimeout(onValueCommitted, IDLE_MS);
      }
    },
    [cropper, held, onValueCommitted]
  );

  useEffect(() => {
    const press = (event: PointerEvent | KeyboardEvent): void => {
      held.add(heldBy(event));
    };

    const release = (event: PointerEvent | KeyboardEvent): void => {
      held.delete(heldBy(event));

      if ("key" in event && event.key === "Meta") {
        for (const key of held) {
          if (typeof key === "string") {
            held.delete(key);
          }
        }
      }

      if (held.size === 0) {
        onValueCommitted();
      }
    };

    const leave = (): void => {
      held.clear();
      onValueCommitted();
    };

    for (const type of PRESSES) {
      globalThis.addEventListener(type, press, true);
    }

    for (const type of RELEASES) {
      globalThis.addEventListener(type, release, true);
    }

    globalThis.addEventListener("blur", leave);

    return () => {
      for (const type of PRESSES) {
        globalThis.removeEventListener(type, press, true);
      }

      for (const type of RELEASES) {
        globalThis.removeEventListener(type, release, true);
      }

      globalThis.removeEventListener("blur", leave);
      onValueCommitted();
    };
  }, [held, onValueCommitted]);

  return { dragging, max, min: 1, onValueChange, onValueCommitted, value };
};

export type { UseZoom };
export { useZoom };
