"use client";

import type { Cropper } from "@zriz/core";
import { useCallback, useSyncExternalStore } from "react";

import { useCropperState, useTarget } from "./use-cropper";

export interface UseZoom {
  value: number;
  min: number;
  max: number;
  dragging: boolean;
  onValueChange: (zoom: number) => void;
  onValueCommitted: () => void;
}

export const useZoom = (
  options: { max?: number; cropper?: Cropper } = {}
): UseZoom => {
  const cropper = useTarget(options.cropper);
  const max = options.max ?? cropper.getMaxZoom();
  const subscribe = useCallback(
    (listener: () => void) => cropper.on("frame", listener),
    [cropper]
  );
  const value = useSyncExternalStore(
    subscribe,
    () => Math.round(cropper.getZoom() * 1000) / 1000,
    () => 1
  );
  const dragging = useCropperState(
    (s) => s.interacting === "zoom-control",
    cropper
  );
  const onValueChange = useCallback(
    (zoom: number) => {
      if (cropper.getState().interacting === null) {
        cropper.begin("zoom-control");
      }
      cropper.setZoom(zoom, { reason: "zoom-control" });
    },
    [cropper]
  );
  const onValueCommitted = useCallback(() => {
    if (cropper.getState().interacting === "zoom-control") {
      cropper.end();
    }
  }, [cropper]);
  return { dragging, max, min: 1, onValueChange, onValueCommitted, value };
};
