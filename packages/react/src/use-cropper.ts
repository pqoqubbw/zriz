"use client";

import { createCropper, sameAspect } from "@zriz/core";
import type {
  Aspect,
  ChangeReason,
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
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { CropperContext } from "./context";
import { useHold, useIsomorphicLayoutEffect, useLatest } from "./part";

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

interface Slot {
  prop?: number;
  at?: number;
}

interface Applied {
  had: boolean;
  busy: boolean;
  options: Set<string>;
  aspect?: Aspect;
  rotation: Slot;
  zoom: Slot;
  width?: number | undefined;
  height?: number | undefined;
}

type Callbacks = Pick<CropperOptions, "onValueChange" | "onValueCommit">;

interface Controlled {
  aspect: Aspect | undefined;
  rotation: number | undefined;
  zoom: number | undefined;
}

const near = (a: number, b = 0): boolean => Math.abs(a - b) <= 1e-6;

const applyNumber = (
  slot: Slot,
  prop: number | undefined,
  read: () => number,
  write: (prop: number) => void,
  forced: boolean
): void => {
  const now = read();
  if (
    prop !== undefined &&
    (prop !== slot.prop || forced || near(now, slot.at))
  ) {
    slot.prop = prop;
    if (!near(now, prop)) {
      write(prop);
    }
    slot.at = read();
  }
};

const applyProps = (
  cropper: Cropper,
  mine: Applied,
  { aspect, rotation, zoom }: Controlled,
  relaxed: boolean
): void => {
  const { disabled, ready } = cropper.getState();
  if (!ready) {
    mine.had = false;
    return;
  }
  if (disabled || mine.busy) {
    return;
  }
  mine.busy = true;
  const emit = mine.had;
  let reason: ChangeReason = "controlled";
  if (
    aspect !== undefined &&
    (mine.aspect === undefined || !sameAspect(aspect, mine.aspect))
  ) {
    mine.aspect = aspect;
    if (!sameAspect(cropper.getValue().aspect, aspect)) {
      cropper.setAspect(aspect, { emit, reason: "aspect" });
      if (cropper.getState().interacting === null) {
        reason = "aspect";
      }
    }
  }
  if (rotation !== mine.rotation.prop || relaxed) {
    applyNumber(
      mine.rotation,
      rotation,
      () => cropper.getValue().rotation,
      (next) => {
        cropper.setRotation(next, { emit, reason });
      },
      false
    );
  }
  const photo = cropper.getCropState()?.image;
  const swapped = photo?.width !== mine.width || photo?.height !== mine.height;
  mine.width = photo?.width;
  mine.height = photo?.height;
  if (zoom !== mine.zoom.prop || relaxed || swapped) {
    const kept = zoom === mine.zoom.prop;
    applyNumber(
      mine.zoom,
      zoom,
      cropper.getZoom,
      (next) => {
        cropper.setZoom(next, {
          emit,
          reason: swapped && kept ? "coverage" : reason,
        });
      },
      swapped
    );
  }
  mine.had = true;
  mine.busy = false;
};

const appliedOf = (
  memory: WeakMap<Cropper, Applied>,
  cropper: Cropper,
  given: boolean
): Applied => {
  const known = memory.get(cropper) ?? {
    busy: false,
    had: given && cropper.getState().ready,
    options: new Set(),
    rotation: {},
    zoom: {},
  };
  memory.set(cropper, known);
  return known;
};

const syncProps = (
  cropper: Cropper,
  memory: { readonly current: WeakMap<Cropper, Applied> },
  given: boolean,
  latest: { readonly current: Controlled },
  relaxed: boolean
): void => {
  applyProps(
    cropper,
    appliedOf(memory.current, cropper, given),
    latest.current,
    relaxed
  );
};

const listen = (
  cropper: Cropper,
  latest: { readonly current: Callbacks }
): (() => void) => {
  const offChange = cropper.on("change", (next, details) => {
    latest.current.onValueChange?.(next, details);
  });
  const offCommit = cropper.on("commit", (next, details) => {
    latest.current.onValueCommit?.(next, details);
  });
  return () => {
    offChange();
    offCommit();
  };
};

const started = new WeakSet<Cropper>();

const startPlugins = (
  cropper: Cropper | null,
  plugins: CropperOptions["plugins"]
): void => {
  if (cropper && !started.has(cropper)) {
    started.add(cropper);
    for (const plugin of plugins ?? []) {
      plugin.init(cropper);
      cropper.on("destroy", () => plugin.destroy?.());
    }
  }
};

const firstSnapshots = new WeakMap<Cropper, CropperSnapshot>();

const firstSnapshot = (cropper: Cropper): CropperSnapshot => {
  const known = firstSnapshots.get(cropper) ?? cropper.getState();
  firstSnapshots.set(cropper, known);
  return known;
};

export const useCropper = (options: UseCropperOptions = {}): Cropper => {
  const {
    cropper: external,
    value,
    aspect,
    rotation,
    zoom,
    onValueChange,
    onValueCommit,
    plugins,
    ...rest
  } = options;
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
  firstSnapshot(cropper);
  const latest = useLatest({
    aspect,
    onValueChange,
    onValueCommit,
    rotation,
    zoom,
  });
  const memory = useRef(new WeakMap<Cropper, Applied>());
  const given = external !== undefined;
  const sync = useCallback(
    (relaxed = false) => {
      syncProps(cropper, memory, given, latest, relaxed);
    },
    [cropper, given, latest]
  );
  useEffect(
    () => () => {
      own?.stop();
    },
    [own]
  );
  useHold(useCallback(() => listen(cropper, latest), [cropper, latest]));
  useIsomorphicLayoutEffect(() => {
    startPlugins(own, plugins);
  }, [own, plugins]);
  useIsomorphicLayoutEffect(() => {
    const patch: Record<string, unknown> = {};
    const { options: set } = appliedOf(memory.current, cropper, given);
    for (const [key, option] of [
      ["disabled", rest.disabled],
      ["maxZoom", rest.maxZoom],
      ["minSize", rest.minSize],
    ] as const) {
      if (option !== undefined) {
        set.add(key);
        patch[key] = option;
      } else if (set.delete(key)) {
        patch[key] = undefined;
      }
    }
    if (Object.keys(patch).length > 0) {
      cropper.setOptions(patch);
      sync(true);
    }
  }, [
    cropper,
    given,
    rest.disabled,
    rest.maxZoom,
    rest.minSize?.width,
    rest.minSize?.height,
    sync,
  ]);
  useIsomorphicLayoutEffect(() => {
    if (value !== undefined && value !== cropper.getValue()) {
      cropper.setValue(value, { emit: false, reason: "controlled" });
    }
  }, [cropper, value]);
  useIsomorphicLayoutEffect(() => {
    const { aspect: first, rotation: angle } = latest.current;
    return given && (first !== undefined || angle !== undefined)
      ? cropper.retarget({ aspect: first, rotation: angle })
      : undefined;
  }, [cropper, given, latest]);
  useIsomorphicLayoutEffect(
    () =>
      cropper.subscribe(() => {
        sync();
      }),
    [cropper, sync]
  );
  useIsomorphicLayoutEffect(() => {
    sync();
  }, [aspect, rotation, sync, zoom]);
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
    () => selector(firstSnapshot(target))
  );
};

export const useCropperValue = (cropper?: Cropper): CropValue => {
  const target = useTarget(cropper);
  const subscribe = useCallback(
    (listener: () => void) => {
      let { ready } = target.getState();
      const offCommit = target.on("commit", listener);
      const offReady = target.subscribe(() => {
        if (target.getState().ready !== ready) {
          ready = !ready;
          listener();
        }
      });
      return () => {
        offCommit();
        offReady();
      };
    },
    [target]
  );
  return useSyncExternalStore(
    subscribe,
    () => target.getState().committed,
    () => firstSnapshot(target).committed
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
