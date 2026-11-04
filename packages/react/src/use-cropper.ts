"use client";

import { createCropper, sameAspect } from "@zriz/core";
import type {
  Aspect,
  Cropper,
  CropperFrame,
  CropperOptions,
  CropperSnapshot,
  CropValue,
} from "@zriz/core";
import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { CropperContext } from "./context";
import { useIsomorphicLayoutEffect, useLatest } from "./part";

export interface UseCropperOptions extends Omit<CropperOptions, "clock"> {
  /** Use this instance instead of creating one. */
  cropper?: Cropper | undefined;
  /** Controlled aspect: a ratio, "free" or "original". */
  aspect?: Aspect | undefined;
  /** Controlled straighten angle in degrees. */
  rotation?: number | undefined;
  /** Controlled zoom, 1 is the largest crop. */
  zoom?: number | undefined;
}

export const useCropper = (options: UseCropperOptions = {}): Cropper => {
  const { cropper: external, value, aspect, rotation, zoom, ...rest } = options;
  const [own] = useState(() =>
    external
      ? null
      : createCropper({
          ...rest,
          defaultValue: {
            ...rest.defaultValue,
            ...(aspect === undefined ? {} : { aspect }),
            ...(rotation === undefined ? {} : { rotation }),
          },
          value,
        })
  );
  const cropper = external ?? own;
  if (!cropper) {
    throw new Error("zriz: no cropper");
  }
  const ready = useSyncExternalStore(
    cropper.subscribe,
    () => cropper.getState().ready,
    () => cropper.getState().ready
  );
  const latest = useLatest(rest);
  const hasChange = rest.onValueChange !== undefined;
  const hasCommit = rest.onValueCommit !== undefined;
  useIsomorphicLayoutEffect(() => {
    const patch: Partial<CropperOptions> = {};
    if (rest.disabled !== undefined) {
      patch.disabled = rest.disabled;
    }
    if (rest.maxZoom !== undefined) {
      patch.maxZoom = rest.maxZoom;
    }
    if (rest.minSize !== undefined) {
      patch.minSize = rest.minSize;
    }
    if (hasChange) {
      patch.onValueChange = (next, details) => {
        latest.current.onValueChange?.(next, details);
      };
    }
    if (hasCommit) {
      patch.onValueCommit = (next, details) => {
        latest.current.onValueCommit?.(next, details);
      };
    }
    if (Object.keys(patch).length > 0) {
      cropper.setOptions(patch);
    }
  }, [
    cropper,
    hasChange,
    hasCommit,
    latest,
    rest.disabled,
    rest.maxZoom,
    rest.minSize?.width,
    rest.minSize?.height,
  ]);
  useIsomorphicLayoutEffect(() => {
    if (value !== undefined && value !== cropper.getValue()) {
      cropper.setValue(value, { emit: false, reason: "controlled" });
    }
  }, [cropper, value]);
  useIsomorphicLayoutEffect(() => {
    if (
      aspect !== undefined &&
      !sameAspect(cropper.getValue().aspect, aspect)
    ) {
      cropper.setAspect(aspect, { reason: "aspect" });
    }
  }, [cropper, aspect, ready, rest.disabled]);
  useIsomorphicLayoutEffect(() => {
    if (rotation !== undefined && cropper.getValue().rotation !== rotation) {
      cropper.setRotation(rotation, { reason: "controlled" });
    }
  }, [cropper, rotation, ready, rest.disabled]);
  useIsomorphicLayoutEffect(() => {
    if (zoom !== undefined && Math.abs(cropper.getZoom() - zoom) > 1e-6) {
      cropper.setZoom(zoom, { reason: "controlled" });
    }
  }, [cropper, zoom, ready, rest.disabled]);
  useEffect(
    () => () => {
      own?.stop();
    },
    [own]
  );
  return cropper;
};

export const useTarget = (cropper?: Cropper): Cropper => {
  const context = useContext(CropperContext);
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
  const subscribe = useCallback(
    (listener: () => void) => target.on("commit", listener),
    [target]
  );
  return useSyncExternalStore(
    subscribe,
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
