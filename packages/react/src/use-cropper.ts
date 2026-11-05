"use client";

import { createCropper, sameAspect } from "@zriz/core";
import type {
  Aspect,
  ChangeReason,
  CropValue,
  Cropper,
  CropperFrame,
  CropperInternals,
  CropperOptions,
  CropperSnapshot,
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

type UseCropperOptions = Omit<CropperOptions, "clock"> & {
  /** Use this instance instead of creating one. */
  cropper?: Cropper | undefined;
  /** Controlled aspect: a ratio, "free" or "original". */
  aspect?: Aspect | undefined;
  /** Controlled straighten angle in degrees. */
  rotation?: number | undefined;
  /** Controlled zoom, 1 is the largest crop. */
  zoom?: number | undefined;
};

type Slot = {
  prop?: number | undefined;
  at?: number;
  sent: number[];
  held?: number | undefined;
};

const ANSWER_WINDOW = 2000;
const ANSWER_GRACE = 500;

const answered = <T>(
  sent: T[],
  prop: T,
  same: (a: T, b: T) => boolean,
  last: number
): boolean => {
  const index =
    performance.now() - last > ANSWER_WINDOW
      ? -1
      : sent.findIndex((item) => same(item, prop));

  sent.splice(0, index + 1 || sent.length);

  return index >= 0;
};

const remember = <T>(
  sent: T[],
  next: T,
  prop: T | undefined,
  same: (a: T, b: T) => boolean
): void => {
  const end = sent.at(-1);

  if (
    !(
      (prop !== undefined && sent.length === 0 && same(next, prop)) ||
      (end !== undefined && same(end, next))
    ) &&
    sent.push(next) > 256
  ) {
    sent.shift();
  }
};

type Applied = {
  had: boolean;
  busy: boolean;
  options: Set<string>;
  aspect?: Aspect | undefined;
  aspects: Aspect[];
  values: CropValue[];
  last: number;
  wrote: boolean;
  rotation: Slot;
  zoom: Slot;
  width?: number | undefined;
  height?: number | undefined;
  heldAspect?: Aspect | undefined;
  heldValue?: { crop: CropValue; value: CropValue } | undefined;
  heldAt: number;
  timer?: ReturnType<typeof setTimeout> | undefined;
  wake?: (() => void) | undefined;
};

type Callbacks = Pick<CropperOptions, "onValueChange" | "onValueCommit">;

type Controlled = {
  aspect: Aspect | undefined;
  rotation: number | undefined;
  zoom: number | undefined;
};

type Listened = Callbacks & Controlled & { value: CropValue | undefined };

const same = Object.is;

const near = (a: number, b = 0): boolean => Math.abs(a - b) <= 1e-6;

const applyNumber = (
  slot: Slot,
  prop: number | undefined,
  read: () => number,
  write: (prop: number) => void,
  forced: boolean,
  last: number
): void => {
  const now = read();
  const fresh = prop !== slot.prop;

  if (
    prop !== undefined &&
    (fresh || forced || (near(now, slot.at) && slot.sent.length === 0))
  ) {
    slot.prop = prop;
    slot.held = undefined;

    if (fresh && !forced && answered(slot.sent, prop, near, last)) {
      slot.at = now;
      slot.held = near(now, prop) ? undefined : now;

      return;
    }

    if (!near(now, prop)) {
      write(prop);
    }

    slot.at = read();
  } else if (prop === undefined) {
    slot.prop = undefined;
    slot.held = undefined;
  }
};

const applyAspect = (
  cropper: Cropper,
  mine: Applied,
  aspect: Aspect | undefined,
  emit: boolean
): ChangeReason => {
  const moved =
    aspect !== undefined &&
    (mine.aspect === undefined || !sameAspect(aspect, mine.aspect));

  const crop = cropper.getValue().aspect;

  mine.aspect = aspect;

  if (moved || aspect === undefined) {
    mine.heldAspect = undefined;
  }

  if (moved && answered(mine.aspects, aspect, sameAspect, mine.last)) {
    mine.heldAspect = sameAspect(crop, aspect) ? undefined : crop;
  } else if (moved && !sameAspect(crop, aspect)) {
    mine.wrote = emit;
    cropper.setAspect(aspect, { emit, reason: "aspect" });

    if (cropper.getState().interacting === null) {
      return "aspect";
    }
  }

  return "controlled";
};

const forget = (mine: Applied): void => {
  mine.heldAspect = undefined;
  mine.heldValue = undefined;
  mine.rotation.held = undefined;
  mine.zoom.held = undefined;
};

const releaseHeld = (
  cropper: Cropper,
  mine: Applied,
  { aspect, rotation, zoom }: Controlled
): void => {
  const value = cropper.getValue();
  const level = cropper.getZoom();
  const { heldAspect, heldValue } = mine;
  const turn = mine.rotation.held;
  const close = mine.zoom.held;

  forget(mine);

  if (heldValue?.crop === value) {
    cropper.setValue(heldValue.value, { emit: false, reason: "controlled" });
  }

  if (
    aspect !== undefined &&
    heldAspect !== undefined &&
    sameAspect(heldAspect, value.aspect)
  ) {
    mine.wrote = true;
    cropper.setAspect(aspect, { reason: "aspect" });
  }

  if (
    rotation !== undefined &&
    turn !== undefined &&
    near(turn, value.rotation)
  ) {
    mine.wrote = true;
    cropper.setRotation(rotation, { reason: "controlled" });
  }

  if (zoom !== undefined && close !== undefined && near(close, level)) {
    mine.wrote = true;
    cropper.setZoom(zoom, { reason: "controlled" });
  }

  mine.rotation.at = cropper.getValue().rotation;
  mine.zoom.at = cropper.getZoom();
};

const settleHeld = (
  cropper: Cropper,
  mine: Applied,
  controlled: Controlled
): void => {
  const held =
    mine.heldAspect ?? mine.heldValue ?? mine.rotation.held ?? mine.zoom.held;

  if (held === undefined) {
    return;
  }

  const due = Math.max(mine.last + ANSWER_WINDOW, mine.heldAt + ANSWER_GRACE);
  const left = due - performance.now();

  if (left > 0 && mine.timer === undefined) {
    mine.timer = setTimeout(() => {
      mine.timer = undefined;
      mine.wake?.();
    }, left);
  } else if (left <= 0 && cropper.getState().interacting === null) {
    releaseHeld(cropper, mine, controlled);
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
    forget(mine);

    return;
  }

  if (disabled || mine.busy) {
    return;
  }

  mine.busy = true;
  const emit = mine.had;
  const before = [mine.heldAspect, mine.rotation.held, mine.zoom.held];
  const reason = applyAspect(cropper, mine, aspect, emit);

  if (rotation !== mine.rotation.prop || relaxed) {
    applyNumber(
      mine.rotation,
      rotation,
      () => cropper.getValue().rotation,
      (next) => {
        mine.wrote = emit;
        cropper.setRotation(next, { emit, reason });
      },
      false,
      mine.last
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
        mine.wrote = emit;

        cropper.setZoom(next, {
          emit,
          reason: swapped && kept ? "coverage" : reason,
        });
      },
      swapped,
      mine.last
    );
  }

  if (
    [mine.heldAspect, mine.rotation.held, mine.zoom.held].some(
      (held, index) => held !== undefined && held !== before[index]
    )
  ) {
    mine.heldAt = performance.now();
  }

  settleHeld(cropper, mine, { aspect, rotation, zoom });
  mine.had = true;
  mine.busy = false;
};

const appliedOf = (
  memory: WeakMap<Cropper, Applied>,
  cropper: Cropper,
  given: boolean
): Applied => {
  const known = memory.get(cropper) ?? {
    aspects: [],
    busy: false,
    had: given && cropper.getState().ready && !cropper.getState().pristine,
    heldAt: 0,
    last: 0,
    options: new Set(),
    rotation: { sent: [] },
    values: [],
    wrote: false,
    zoom: { sent: [] },
  };

  memory.set(cropper, known);

  return known;
};

const syncProps = (
  cropper: Cropper,
  memory: WeakMap<Cropper, Applied>,
  given: boolean,
  latest: { readonly current: Controlled },
  relaxed: boolean
): void => {
  applyProps(
    cropper,
    appliedOf(memory, cropper, given),
    latest.current,
    relaxed
  );
};

const listen = (
  cropper: Cropper,
  latest: { readonly current: Listened },
  mine: Applied,
  wake: () => void
): (() => void) => {
  mine.wake = wake;
  const offChange = cropper.on("change", (next, details) => {
    const { aspect, onValueChange, onValueCommit, rotation, value, zoom } =
      latest.current;
    const { wrote } = mine;
    const level = cropper.getZoom();

    mine.wrote = false;

    if (onValueChange || onValueCommit) {
      mine.last = performance.now();
      remember(mine.aspects, next.aspect, aspect, sameAspect);
      remember(mine.rotation.sent, next.rotation, rotation, near);
      remember(mine.zoom.sent, level, zoom, near);
      remember(mine.values, next, value, same);
    }

    if (
      !(
        wrote &&
        (aspect === undefined || sameAspect(next.aspect, aspect)) &&
        (rotation === undefined || near(next.rotation, rotation)) &&
        (zoom === undefined || near(level, zoom))
      )
    ) {
      onValueChange?.(next, details);
    }
  });
  const offCommit = cropper.on("commit", (next, details) => {
    latest.current.onValueCommit?.(next, details);
  });

  return () => {
    clearTimeout(mine.timer);
    mine.timer = undefined;
    mine.wake = undefined;
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

const firstSnapshots = new WeakMap<
  Cropper,
  readonly [CropperSnapshot, number, number]
>();

const firstValues = (
  cropper: Cropper
): readonly [CropperSnapshot, number, number] => {
  const known = firstSnapshots.get(cropper) ?? [
    cropper.getState(),
    cropper.getZoom(),
    cropper.getMaxZoom(),
  ];

  firstSnapshots.set(cropper, known);

  return known;
};

const firstSnapshot = (cropper: Cropper): CropperSnapshot =>
  firstValues(cropper)[0];

const firstZoom = (cropper: Cropper, max?: number): number => {
  const [, zoom, top] = firstValues(cropper);

  return Math.round(Math.min(zoom, max ?? top) * 100) / 100;
};

const useCropper = (options: UseCropperOptions = {}): Cropper => {
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
    value,
    zoom,
  });
  const [memory] = useState(() => new WeakMap<Cropper, Applied>());
  const given = external !== undefined;
  const sync = useCallback(
    (relaxed = false) => {
      syncProps(cropper, memory, given, latest, relaxed);
    },
    [cropper, given, latest, memory]
  );

  useEffect(
    () => () => {
      own?.stop();
    },
    [own]
  );

  useHold(
    useCallback(
      () =>
        listen(cropper, latest, appliedOf(memory, cropper, given), () => {
          syncProps(cropper, memory, given, latest, false);
        }),
      [cropper, given, latest, memory]
    )
  );

  useIsomorphicLayoutEffect(() => {
    startPlugins(own, plugins);
  }, [own, plugins]);

  useIsomorphicLayoutEffect(() => {
    const patch: Record<string, unknown> = {};
    const { options: set } = appliedOf(memory, cropper, given);

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
    const mine = appliedOf(memory, cropper, given);
    const crop = cropper.getValue();

    mine.heldValue = undefined;

    if (value !== undefined && value !== crop) {
      if (answered(mine.values, value, same, mine.last)) {
        mine.heldValue = { crop, value };
        mine.heldAt = performance.now();
        sync();
      } else {
        cropper.setValue(value, { emit: false, reason: "controlled" });
      }
    }
  }, [cropper, given, memory, sync, value]);

  useIsomorphicLayoutEffect(() => {
    const { aspect: first, rotation: angle, zoom: close } = latest.current;
    const empty =
      close === undefined && (!given || (first ?? angle) === undefined);

    return empty
      ? undefined
      : (cropper as CropperInternals).retarget(
          given
            ? { aspect: first, rotation: angle, zoom: close }
            : { zoom: close }
        );
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

const useTarget = (cropper?: Cropper): Cropper => {
  const context = useContext(CropperContext);
  const target = cropper ?? context;

  if (!target) {
    throw new Error("zriz: pass a cropper or render inside <Cropper.Root>");
  }

  return target;
};

const useCropperState = <T>(
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

const useAriaDisabled = (): true | undefined =>
  useCropperState((s) => s.disabled) || undefined;

const firstCommitted = (cropper: Cropper): CropValue =>
  firstSnapshot(cropper).committed;

const useCropperValue = (cropper?: Cropper): CropValue => {
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
    () => firstCommitted(target)
  );
};

const useCircleAspect = (
  cropper: Cropper,
  shape: "rect" | "circle",
  aspect: Aspect | undefined,
  defaultAspect: Aspect | undefined,
  given: boolean
): void => {
  const before = cropper.getValue().aspect;
  const [start] = useState(() => {
    const fallback = given ? before : (defaultAspect ?? "free");

    return shape === "circle" ? fallback : null;
  });
  const held = useRef({ aspect: start ?? before, due: start !== null });
  const disabled = useCropperState((s) => s.disabled, cropper);
  const { ready } = cropper.getState();

  useIsomorphicLayoutEffect(() => {
    const kept = held.current;

    if (shape === "circle" && !kept.due) {
      kept.aspect = before;
      kept.due = true;
    } else if (shape !== "circle" && kept.due && !disabled) {
      kept.due = false;

      if (aspect === undefined && ready) {
        cropper.setAspect(kept.aspect, { reason: "aspect" });
      } else if (aspect === undefined) {
        cropper.setValue({ aspect: kept.aspect }, { emit: false });
      }
    }
  }, [cropper, disabled, shape]);

  useIsomorphicLayoutEffect(
    () =>
      start === null || shape === "circle"
        ? undefined
        : (cropper as CropperInternals).retarget({ aspect: aspect ?? start }),
    [cropper, shape, start]
  );
};

const useCropperFrame = (
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

export type { UseCropperOptions };
export {
  firstCommitted,
  firstZoom,
  useAriaDisabled,
  useCircleAspect,
  useCropper,
  useCropperFrame,
  useCropperState,
  useCropperValue,
  useTarget,
};
