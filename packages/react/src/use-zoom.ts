"use client";

import type { Cropper } from "@zriz/core";
import { useCallback, useSyncExternalStore, use } from "react";

import { CropperContext } from "./context";
import { useCropperState } from "./use-cropper";

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
  const context = use(CropperContext);
  const cropper = options.cropper ?? context;
  if (!cropper) {
    throw new Error("zriz: pass a cropper or render inside <Cropper.Root>");
  }
  const max = options.max ?? 15;
  const value = useSyncExternalStore(
    (listener) => cropper.on("frame", listener),
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
