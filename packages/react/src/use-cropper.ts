"use client";

import { createCropper } from "@zriz/core";
import type {
  Cropper,
  CropperFrame,
  CropperOptions,
  CropperSnapshot,
  CropValue,
} from "@zriz/core";
import { use, useEffect, useState, useSyncExternalStore } from "react";

import { CropperContext } from "./context";
import { useIsomorphicLayoutEffect, useLatest } from "./part";

export interface UseCropperOptions extends Omit<CropperOptions, "clock"> {
  /** Use this instance instead of creating one. */
  cropper?: Cropper | undefined;
}

export const useCropper = (options: UseCropperOptions = {}): Cropper => {
  const { cropper: external, value, ...rest } = options;
  const [own] = useState(() =>
    external ? null : createCropper({ ...rest, value })
  );
  const cropper = external ?? own;
  if (!cropper) {
    throw new Error("zriz: no cropper");
  }
  const latest = useLatest(rest);
  useIsomorphicLayoutEffect(() => {
    cropper.setOptions({
      disabled: rest.disabled,
      maxZoom: rest.maxZoom,
      minSize: rest.minSize,
      onValueChange: (next, details) =>
        latest.current.onValueChange?.(next, details),
      onValueCommit: (next, details) =>
        latest.current.onValueCommit?.(next, details),
    });
  }, [cropper, rest.disabled, rest.maxZoom, rest.minSize]);
  useIsomorphicLayoutEffect(() => {
    if (value !== undefined) {
      cropper.setValue(value, { emit: false, reason: "controlled" });
    }
  }, [cropper, value]);
  useEffect(
    () => () => {
      own?.stop();
    },
    [own]
  );
  return cropper;
};

const useTarget = (cropper?: Cropper): Cropper => {
  const context = use(CropperContext);
  const target = cropper ?? context;
  if (!target) {
    throw new Error("zriz: pass a cropper or render inside <Cropper.Root>");
  }
  return target;
};

export const useCropperState = <T>(
  selector: (snapshot: CropperSnapshot) => T,
  cropper?: Cropper
): T => {
  const target = useTarget(cropper);
  return useSyncExternalStore(
    target.subscribe,
    () => selector(target.getState()),
    () => selector(target.getState())
  );
};

export const useCropperValue = (cropper?: Cropper): CropValue => {
  const target = useTarget(cropper);
  return useSyncExternalStore(
    (listener) => target.on("commit", listener),
    () => target.getState().committed,
    () => target.getState().committed
  );
};

export const useCropperFrame = (
  listener: (frame: CropperFrame) => void,
  cropper?: Cropper
): void => {
  const target = useTarget(cropper);
  const latest = useLatest(listener);
  useEffect(
    () =>
      target.on("frame", (frame) => {
        latest.current(frame);
      }),
    [latest, target]
  );
};
