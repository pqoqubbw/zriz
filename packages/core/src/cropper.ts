import { sinCosDegrees, toQuarterTurns } from "./geometry/angle";
import { straightenLimit } from "./geometry/constraints";
import { largestFit, minScaleAt } from "./geometry/coverage";
import { exportPlan } from "./geometry/export-plan";
import type { ExportPlan } from "./geometry/export-plan";
import {
  imagePlanes,
  insidePlanes,
  panPlanes,
  projectOntoPlanes,
} from "./geometry/planes";
import {
  mirrorX,
  mirrorY,
  rotateLeft,
  rotateRight,
  sameFields,
  setAngle,
  turnedSize,
} from "./geometry/state";
import type { CropState, HalfPlane, Point, Size } from "./geometry/types";
import { frameClock } from "./motion";
import type { Clock } from "./motion";
import {
  ROTATION_LIMIT,
  aspectRatio,
  changedFields,
  clamp,
  clean,
  defaultValue,
  focalLength,
  holdCrop,
  isSound,
  positive,
  readValue,
  seal,
  stateToValue,
  toAspect,
  valueToState,
  valuesEqual,
} from "./value";
import type { Aspect, CropValue, ValueField } from "./value";

export type ChangeReason =
  | "pan"
  | "pinch"
  | "wheel"
  | "resize"
  | "dial"
  | "keyboard"
  | "zoom-control"
  | "aspect"
  | "orientation"
  | "rotate-90"
  | "flip"
  | "reset"
  | "coverage"
  | "history"
  | "controlled"
  | "imperative";

export type ChangePhase = "start" | "move" | "end" | "instant";

export interface ChangeDetails {
  reason: ChangeReason;
  phase: ChangePhase;
  changed: readonly ValueField[];
  event: Event | undefined;
  previous: CropValue;
  cancel: () => void;
  readonly isCanceled: boolean;
}

export interface CommitDetails {
  reason: ChangeReason;
  event: Event | undefined;
  previous: CropValue;
  pixelCrop: ExportPlan | null;
}

export interface CropperSnapshot {
  ready: boolean;
  interacting: ChangeReason | null;
  settling: boolean;
  pristine: boolean;
  disabled: boolean;
  aspect: Aspect;
  quarterTurns: CropValue["quarterTurns"];
  mirrored: boolean;
  committed: CropValue;
}

export interface CropperFrame {
  time: number;
  value: CropValue;
  state: CropState | null;
}

export interface CropperEvents {
  change: (value: CropValue, details: ChangeDetails) => void;
  accept: (value: CropValue, details: ChangeDetails) => void;
  commit: (value: CropValue, details: CommitDetails) => void;
  gesturestart: (reason: ChangeReason, event: Event | undefined) => void;
  gestureend: (reason: ChangeReason, event: Event | undefined) => void;
  settle: () => void;
  frame: (frame: CropperFrame) => void;
  stop: () => void;
  destroy: () => void;
}

export interface CropperPlugin {
  name: string;
  init: (cropper: Cropper) => void;
  destroy?: (() => void) | undefined;
}

export interface CropperOptions {
  image?: Size | null | undefined;
  value?: CropValue | undefined;
  defaultValue?: Partial<CropValue> | undefined;
  minSize?: Size | undefined;
  maxZoom?: number | undefined;
  focalLength?: number | undefined;
  disabled?: boolean | undefined;
  clock?: Clock | undefined;
  onValueChange?: CropperEvents["change"] | undefined;
  onValueCommit?: CropperEvents["commit"] | undefined;
  plugins?: readonly CropperPlugin[] | undefined;
}

export interface ActionOptions {
  reason?: ChangeReason | undefined;
  event?: Event | undefined;
  emit?: boolean | undefined;
}

export type FrameTask = (time: number, delta: number) => boolean;

export interface Cropper {
  getValue: () => CropValue;
  getState: () => CropperSnapshot;
  getCropState: () => CropState | null;
  subscribe: (listener: () => void) => () => void;
  on: <E extends keyof CropperEvents>(
    type: E,
    listener: CropperEvents[E]
  ) => () => void;
  setImage: (image: Size | null) => void;
  setOptions: (options: Partial<CropperOptions>) => void;
  setValue: (value: Partial<CropValue>, options?: ActionOptions) => void;
  setRotation: (degrees: number, options?: ActionOptions) => void;
  setZoom: (
    zoom: number,
    options?: ActionOptions & { anchor?: Point | undefined }
  ) => void;
  panBy: (dx: number, dy: number, options?: ActionOptions) => void;
  setAspect: (aspect: Aspect, options?: ActionOptions) => void;
  rotate90: (direction?: "ccw" | "cw", options?: ActionOptions) => void;
  flip: (axis?: "x" | "y", options?: ActionOptions) => void;
  reset: (options?: ActionOptions) => void;
  getZoom: () => number;
  getRotationLimit: () => number;
  getPixelCrop: (scale?: number) => ExportPlan | null;
  begin: (reason: ChangeReason, event?: Event, owner?: unknown) => boolean;
  end: (event?: Event, owner?: unknown) => void;
  cancel: (event?: Event, owner?: unknown) => void;
  coast: (owner: unknown, release: () => void) => void;
  rebase: (owner: unknown) => boolean;
  getMaxZoom: () => number;
  getMinSize: () => Size;
  retarget: (value: Record<string, unknown>) => () => void;
  setCropState: (
    next: CropState,
    options?: ActionOptions & { keep?: "size" | "centre" | undefined }
  ) => void;
  run: (task: FrameTask, blocking?: boolean) => () => void;
  invalidate: () => void;
  stop: () => void;
  destroy: () => void;
}

export const MAX_ZOOM = 15;
const EPSILON = 1e-9;

type Listeners = { [E in keyof CropperEvents]: Set<CropperEvents[E]> };

interface Gesture {
  reason: ChangeReason;
  start: CropState | null;
  startValue: CropValue;
  flushed: boolean;
  owner: unknown;
  coast?: (() => void) | undefined;
}

const attempt = <T>(call: () => T): T | undefined => {
  try {
    return call();
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
    return undefined;
  }
};

const callAll = <L extends (...args: never[]) => void>(
  set: Set<L>,
  args: Parameters<L>
): void => {
  const current = [...set];
  for (const listener of current) {
    if (set.has(listener)) {
      attempt(() => {
        Reflect.apply(listener, undefined, args);
      });
    }
  }
};

const noop = (): void => undefined;

const isTrue = (flag: unknown): boolean => flag === true;

const minSide = (given: number | undefined, limit: number): number =>
  Math.min(given !== undefined && given > 0 ? given : 1, limit);

const holdIf = (
  computed: CropValue,
  held: CropValue | undefined,
  size: Size
): CropValue => {
  if (!held) {
    return computed;
  }
  const kept = holdCrop(computed, held, size);
  return valuesEqual(kept, held) ? held : kept;
};

const heldValue = (fixed: CropState, held: CropValue): CropValue =>
  holdIf(stateToValue(fixed, held.aspect), held, fixed.image);

const lengthenLens = (state: CropState): CropState => {
  const { focal, horizontal, vertical } = state.perspective;
  const h = sinCosDegrees(horizontal);
  const shortest =
    (Math.abs(h.sin) * state.image.width +
      Math.abs(h.cos * sinCosDegrees(vertical).sin) * state.image.height) /
    1.8;
  return focal < shortest
    ? { ...state, perspective: { ...state.perspective, focal: shortest } }
    : state;
};

const zoomOf = (planes: readonly HalfPlane[], size: Size): number =>
  1 / largestFit(planes, size).scale;

export const createCropper = (initial: CropperOptions = {}): Cropper => {
  let options: CropperOptions = initial;
  const clock = initial.clock ?? frameClock();
  const listeners: Listeners = {
    accept: new Set(),
    change: new Set(),
    commit: new Set(),
    destroy: new Set(),
    frame: new Set(),
    gestureend: new Set(),
    gesturestart: new Set(),
    settle: new Set(),
    stop: new Set(),
  };
  const subscribers = new Set<() => void>();
  const tasks = new Map<FrameTask, { holds: boolean }>();
  const blocking = (): boolean =>
    [...tasks.values()].some((entry) => entry.holds);

  const firstReset = readValue(initial.defaultValue ?? {}, defaultValue);
  const targets = new Set<Record<string, unknown>>();
  let resetValue = firstReset;
  let locked: Aspect | undefined;
  let image: Size | null = initial.image ?? null;
  let value = initial.value ? readValue(initial.value, resetValue) : resetValue;
  let state: CropState | null = null;
  let emitted = value;
  let emittedState: CropState | null = null;
  let committed = value;
  let dirty = false;
  let dirtyReason: ChangeReason = "imperative";
  let dirtyEvent: Event | undefined;
  let gesture: Gesture | null = null;
  let afterGesture = false;
  let outside = false;
  let settlePending = false;
  let commitPending: { reason: ChangeReason; event: Event | undefined } | null =
    null;
  let frameDirty = false;
  let handle: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;
  let snapshot: CropperSnapshot;

  const emit = <E extends keyof CropperEvents>(
    type: E,
    ...args: Parameters<CropperEvents[E]>
  ): void => {
    callAll(listeners[type], args);
  };

  const emitFrame = (time: number): void => {
    emit("frame", { state, time, value });
  };

  const focal = (size: Size): number =>
    focalLength(size, positive(options.focalLength, 26));

  const zoomCap = (): number =>
    Math.max(options.maxZoom ?? MAX_ZOOM, 1) || MAX_ZOOM;

  const minSize = (size: Size): Size => ({
    height: minSide(options.minSize?.height, size.height),
    width: minSide(options.minSize?.width, size.width),
  });

  const scaleToMin = (next: CropState): CropState => {
    const { width, height } = next.crop;
    const min = minSize(next.image);
    const grow = Math.max(1, min.width / width, min.height / height);
    return {
      ...next,
      crop: { ...next.crop, height: height * grow, width: width * grow },
    };
  };

  const rotationLimit = (): number => {
    if (!image) {
      return ROTATION_LIMIT;
    }
    const min = minSize(image);
    return Math.min(
      ROTATION_LIMIT,
      straightenLimit(image, min.width, min.height)
    );
  };

  const limitAngle = (angle: number): number =>
    clean(clamp(angle, rotationLimit()));

  const constrain = (next: CropState, keep: "size" | "centre"): CropState => {
    const angle = limitAngle(next.angle);
    const shaped = lengthenLens(
      angle === next.angle ? next : setAngle(next, angle)
    );
    const planes = imagePlanes(shaped);
    const reach = 1e6 * Math.max(shaped.image.width, shaped.image.height);
    let width = Math.min(shaped.crop.width, reach);
    let height = Math.min(shaped.crop.height, reach);
    if (
      shaped.aspect !== null &&
      Math.abs(width / height - shaped.aspect) > EPSILON
    ) {
      const area = width * height;
      height = Math.sqrt(area / shaped.aspect);
      width = height * shaped.aspect;
    }
    const asked = minSize(shaped.image);
    const short = Math.max(1, largestFit(planes, asked).scale);
    const min = { height: asked.height / short, width: asked.width / short };
    const free = shaped.aspect === null;
    if (free) {
      width = Math.max(width, min.width);
      height = Math.max(height, min.height);
    }
    const maxZoom = zoomCap();
    const base = largestFit(planes, { height, width }).scale;
    const grow = Math.max(
      1,
      min.width / width,
      min.height / height,
      1 / (base * maxZoom)
    );
    width *= grow;
    height *= grow;
    let fit = base * grow;
    if (keep === "centre" && insidePlanes(planes, shaped.crop, -EPSILON)) {
      const over = Math.min(
        minScaleAt(planes, { height, width }, shaped.crop),
        maxZoom * fit,
        width / min.width,
        height / min.height
      );
      if (over > 1) {
        width /= over;
        height /= over;
        fit /= over;
      }
    }
    if (fit > 1) {
      const narrow = width / fit < min.width;
      if (
        free &&
        short <= 1 + EPSILON &&
        narrow !== height / fit < min.height
      ) {
        const open = Math.max(
          narrow ? min.height : min.width,
          zoomOf(
            panPlanes(planes, narrow ? min.width : 0, narrow ? 0 : min.height),
            { height: narrow ? 1 : 0, width: narrow ? 0 : 1 }
          )
        );
        width = narrow ? min.width : open;
        height = narrow ? open : min.height;
      } else {
        width /= fit;
        height /= fit;
      }
    }
    const centre = projectOntoPlanes(
      panPlanes(planes, width, height),
      shaped.crop,
      1e-9 + 1e-18 * reach
    );
    return seal({
      ...shaped,
      crop: { height, width, x: centre.x, y: centre.y },
    });
  };

  let resetFit: CropValue = resetValue;
  const isPristine = (): boolean =>
    valuesEqual(value, resetValue) || valuesEqual(value, resetFit);

  const makeSnapshot = (): CropperSnapshot => ({
    aspect: value.aspect,
    committed,
    disabled: options.disabled ?? false,
    interacting: gesture?.reason ?? null,
    mirrored: value.mirrored,
    pristine: isPristine(),
    quarterTurns: value.quarterTurns,
    ready: state !== null,
    settling: tasks.size > 0,
  });

  snapshot = makeSnapshot();

  const refresh = (always = false): void => {
    const next = makeSnapshot();
    if (!always && sameFields(next, snapshot)) {
      return;
    }
    snapshot = next;
    callAll(subscribers, []);
  };

  const sendCommit = (event: Event | undefined, reason: ChangeReason): void => {
    const sent = value;
    const details: CommitDetails = {
      event,
      pixelCrop: state ? exportPlan(state) : null,
      previous: committed,
      reason,
    };
    committed = sent;
    refresh();
    if (committed === sent) {
      emit("commit", sent, details);
    }
  };

  const settleCommit = (): void => {
    if (gesture || blocking() || dirty || !commitPending) {
      return;
    }
    const pending = commitPending;
    commitPending = null;
    afterGesture = false;
    if (valuesEqual(value, committed)) {
      return;
    }
    sendCommit(pending.event, pending.reason);
  };

  const refit = (
    saved: CropState | null,
    savedValue: CropValue
  ): [CropState | null, CropValue] => {
    if (!saved) {
      return [saved, savedValue];
    }
    const fixed = constrain(saved, "centre");
    const fixedValue = heldValue(fixed, savedValue);
    return fixedValue === savedValue
      ? [saved, savedValue]
      : [fixed, fixedValue];
  };

  const flush = (): void => {
    if (!dirty) {
      return;
    }
    dirty = false;
    let phase: ChangePhase = "instant";
    if (gesture || blocking()) {
      phase = gesture && !gesture.flushed ? "start" : "move";
    } else if (afterGesture) {
      phase = "end";
    }
    let canceled = false;
    const details: ChangeDetails = {
      cancel() {
        canceled = true;
      },
      changed: changedFields(emitted, value),
      event: dirtyEvent,
      get isCanceled() {
        return canceled;
      },
      phase,
      previous: emitted,
      reason: dirtyReason,
    };
    dirtyEvent = undefined;
    if (details.changed.length === 0) {
      return;
    }
    if (gesture) {
      gesture.flushed = true;
    }
    const sent = value;
    const sentState = state;
    emit("change", sent, details);
    if (canceled) {
      [state, value] = refit(emittedState, emitted);
      emittedState = state;
      emitted = value;
      return;
    }
    if (emitted === details.previous) {
      emitted = sent;
      emittedState = sentState;
    }
    emit("accept", sent, details);
  };

  const tick = (time: number): void => {
    handle = null;
    const delta = lastTime === null ? 0 : Math.max(0, time - lastTime);
    lastTime = time;
    const wasSettling = snapshot.settling;
    if (tasks.size > 0) {
      frameDirty = true;
    }
    for (const task of tasks.keys()) {
      if (!(attempt(() => task(time, delta)) ?? false)) {
        tasks.delete(task);
      }
    }
    flush();
    if (frameDirty) {
      frameDirty = false;
      emitFrame(time);
    }
    settleCommit();
    refresh();
    if ((wasSettling || settlePending) && tasks.size === 0) {
      settlePending = false;
      emit("settle");
    }
    if ((tasks.size > 0 || dirty) && !destroyed) {
      handle ??= clock.request(tick);
    } else if (handle === null) {
      lastTime = null;
    }
  };

  const schedule = (): void => {
    if (handle === null && !destroyed) {
      handle = clock.request(tick);
    }
  };

  const invalidate = (): void => {
    frameDirty = true;
    schedule();
  };

  const unschedule = (): void => {
    if (handle !== null) {
      clock.cancel(handle);
      handle = null;
    }
  };

  const markSent = (): void => {
    emitted = value;
    emittedState = state;
    committed = value;
  };

  const restartGesture = (): void => {
    if (gesture) {
      gesture.start = state;
      gesture.startValue = value;
      outside = true;
    }
  };

  const join = <T>(set: Set<T>, item: T): (() => void) => {
    if (destroyed) {
      return noop;
    }
    set.add(item);
    return () => {
      set.delete(item);
    };
  };

  const dropHolding = (): void => {
    for (const [task, entry] of tasks) {
      if (entry.holds) {
        tasks.delete(task);
        settlePending = true;
      }
    }
  };

  const stopCoast = (): void => {
    if (gesture?.coast) {
      dropHolding();
      gesture.coast();
    }
  };

  const accept = (
    next: CropState | null,
    nextValue: CropValue,
    action: ActionOptions,
    fallback: ChangeReason
  ): void => {
    if (
      destroyed ||
      (action.reason === "controlled" && (gesture !== null || afterGesture))
    ) {
      return;
    }
    if (valuesEqual(value, nextValue)) {
      if (next && next.perspective.focal !== state?.perspective.focal) {
        state = next;
        if (!dirty) {
          emittedState = next;
        }
        invalidate();
      }
      if (action.emit === false && action.reason !== "controlled" && dirty) {
        markSent();
        refresh();
      }
      return;
    }
    if (gesture && action.reason !== gesture.reason) {
      outside = true;
      stopCoast();
    }
    state = next;
    value = nextValue;
    frameDirty = true;
    if (action.emit === false) {
      markSent();
    } else {
      dirty = true;
      dirtyReason = action.reason ?? gesture?.reason ?? fallback;
      dirtyEvent = action.event;
      if (!gesture) {
        commitPending = { event: action.event, reason: dirtyReason };
      }
    }
    schedule();
    refresh();
  };

  const commitState = (
    next: CropState,
    keep: "size" | "centre",
    action: ActionOptions,
    fallback: ChangeReason,
    aspect: Aspect = value.aspect,
    given?: CropValue
  ): void => {
    const fixed = constrain(next, keep);
    const fixedValue = holdIf(
      holdIf(stateToValue(fixed, aspect), given, fixed.image),
      value,
      fixed.image
    );
    if (isSound(fixedValue)) {
      accept(fixed, fixedValue, action, fallback);
    }
  };

  const fromValue = (next: CropValue, size: Size): CropState =>
    valueToState(
      { ...next, rotation: limitAngle(next.rotation) },
      size,
      focal(size)
    );

  const placed = (next: CropValue, size: Size): CropState =>
    constrain(fromValue(next, size), "centre");

  const fitReset = (): void => {
    resetFit = image
      ? heldValue(placed(resetValue, image), resetValue)
      : resetValue;
  };

  const disabled = (): boolean => destroyed || (options.disabled ?? false);

  const applyValue = (
    next: CropValue,
    action: ActionOptions,
    reason: ChangeReason
  ): void => {
    if (!image) {
      accept(null, next, action, reason);
      return;
    }
    commitState(
      fromValue(next, image),
      "centre",
      action,
      reason,
      next.aspect,
      next
    );
  };

  const cropper: Cropper = {
    begin(reason, event, owner) {
      if (disabled() || (gesture !== null && gesture.owner !== owner)) {
        return false;
      }
      dropHolding();
      if (gesture === null) {
        flush();
        settleCommit();
      }
      outside = false;
      const restart = gesture !== null;
      gesture = {
        flushed: gesture?.flushed ?? false,
        owner,
        reason,
        start: gesture?.start ?? state,
        startValue: gesture?.startValue ?? value,
      };
      refresh();
      if (!restart) {
        emit("gesturestart", reason, event);
      }
      return true;
    },
    cancel(event, owner) {
      if (!gesture || gesture.owner !== owner) {
        return;
      }
      const { start, startValue, reason } = gesture;
      dropHolding();
      const [fitted, fittedValue] = refit(start, startValue);
      accept(fitted, fittedValue, { event, reason }, reason);
      cropper.end(event, owner);
    },
    coast(owner, release) {
      if (gesture && gesture.owner === owner) {
        gesture.coast = release;
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      unschedule();
      for (const plugin of initial.plugins ?? []) {
        attempt(() => plugin.destroy?.());
      }
      emit("destroy");
      state = null;
      gesture = null;
      commitPending = null;
      dirty = false;
      tasks.clear();
      subscribers.clear();
      for (const set of Object.values(listeners)) {
        set.clear();
      }
      refresh();
    },
    end(event, owner) {
      if (!gesture || gesture.owner !== owner) {
        return;
      }
      const { reason } = gesture;
      gesture = null;
      afterGesture = true;
      commitPending = { event, reason };
      refresh();
      emit("gestureend", reason, event);
      schedule();
    },
    flip(axis = "x", action = {}) {
      if (!state || disabled()) {
        return;
      }
      const next = axis === "x" ? mirrorX(state) : mirrorY(state);
      commitState(next, "size", action, "flip");
    },
    getCropState: () => state,
    getMaxZoom: zoomCap,
    getMinSize: () => minSize(image ?? { height: 1, width: 1 }),
    getPixelCrop: (scale) => (state ? exportPlan(state, scale) : null),
    getRotationLimit: rotationLimit,
    getState: () => snapshot,
    getValue: () => value,
    getZoom() {
      if (!state) {
        return 1;
      }
      return zoomOf(imagePlanes(state), state.crop);
    },
    invalidate,
    on: (type, listener) =>
      join(listeners[type] as Set<typeof listener>, listener),
    panBy(dx, dy, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const { width, height } = turnedSize(state.image, state.turns);
      const next = {
        ...state,
        crop: {
          ...state.crop,
          x: state.crop.x + dx * width,
          y: state.crop.y + dy * height,
        },
      };
      commitState(next, "size", action, "pan");
    },
    rebase(owner) {
      if (!outside || !gesture || gesture.owner !== owner) {
        return false;
      }
      restartGesture();
      outside = false;
      return true;
    },
    reset(action = {}) {
      if (disabled()) {
        return;
      }
      applyValue(resetValue, action, "reset");
    },
    retarget(next) {
      const aim = (): void => {
        resetValue = firstReset;
        locked = undefined;
        for (const patch of targets) {
          resetValue = readValue(patch, resetValue);
          if (patch.lock === true) {
            locked = resetValue.aspect;
          }
        }
        fitReset();
        refresh();
      };
      targets.add(next);
      aim();
      return () => {
        targets.delete(next);
        aim();
      };
    },
    rotate90(direction = "ccw", action = {}) {
      if (!state || disabled()) {
        return;
      }
      const next = direction === "ccw" ? rotateLeft(state) : rotateRight(state);
      const aspect =
        typeof value.aspect === "number" ? 1 / value.aspect : value.aspect;
      commitState(next, "size", action, "rotate-90", aspect);
    },
    run(task, holds = true) {
      if (destroyed) {
        return noop;
      }
      const entry = { holds };
      tasks.set(task, entry);
      schedule();
      refresh();
      return () => {
        if (tasks.get(task) === entry) {
          tasks.delete(task);
          schedule();
        }
      };
    },
    setAspect(given, action = {}) {
      const aspect = toAspect(given);
      if (!state || disabled() || (locked !== undefined && aspect !== locked)) {
        return;
      }
      const ratio = aspectRatio(aspect, state.image, state.turns);
      let next: CropState = { ...state, aspect: ratio };
      if (ratio !== null) {
        const planes = imagePlanes(state);
        const unit = { height: 1, width: ratio };
        const height = insidePlanes(planes, state.crop, -EPSILON)
          ? 1 / minScaleAt(planes, unit, state.crop)
          : zoomOf(planes, unit);
        next = {
          ...next,
          crop: { ...state.crop, height, width: height * ratio },
        };
      }
      commitState(next, "centre", action, "aspect", aspect);
    },
    setCropState(next, action = {}) {
      if (!state || disabled() || !sameFields(state.image, next.image)) {
        return;
      }
      const turns = toQuarterTurns(next.turns);
      const given = {
        ...next,
        aspect: aspectRatio(value.aspect, state.image, turns),
        flip: isTrue(next.flip),
        image: state.image,
        perspective: { ...next.perspective, focal: state.perspective.focal },
        turns,
      };
      const shape =
        (next.crop.width * state.crop.height) /
        (next.crop.height * state.crop.width);
      commitState(
        Math.abs(shape - 1) < EPSILON ? scaleToMin(given) : given,
        action.keep ?? "size",
        action,
        "imperative"
      );
    },
    setImage(given) {
      if (destroyed) {
        return;
      }
      stopCoast();
      const next =
        given &&
        Number.isFinite(given.width) &&
        Number.isFinite(given.height) &&
        given.width > 0 &&
        given.height > 0
          ? {
              height: Math.round(given.height) || 1,
              width: Math.round(given.width) || 1,
            }
          : null;
      const first = state === null;
      image = next;
      fitReset();
      if (!next) {
        state = null;
        emittedState = null;
        if (gesture) {
          gesture.start = null;
          outside = true;
        }
        invalidate();
        refresh();
        return;
      }
      const fixed = placed(value, next);
      const fixedValue = heldValue(fixed, value);
      if (first) {
        state = fixed;
        value = fixedValue;
        markSent();
      } else {
        emittedState = placed(emitted, next);
        state = fixed;
        accept(fixed, fixedValue, { reason: "coverage" }, "coverage");
      }
      invalidate();
      if (!first && gesture) {
        flush();
        if (!valuesEqual(value, committed)) {
          sendCommit(undefined, "coverage");
        }
      }
      restartGesture();
      refresh(true);
    },
    setOptions(next) {
      if (destroyed) {
        return;
      }
      options = { ...options, ...next };
      fitReset();
      if (state && image) {
        commitState(state, "centre", { reason: "coverage" }, "coverage");
      }
      invalidate();
      refresh();
    },
    setRotation(degrees, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const angle = limitAngle(degrees);
      const start = gesture?.start;
      let next = setAngle(state, angle);
      if (start && start.turns === state.turns) {
        next = {
          ...next,
          crop: {
            ...(gesture?.reason === "dial" && start.flip === state.flip
              ? setAngle(start, angle)
              : next
            ).crop,
            height: start.crop.height,
            width: start.crop.width,
          },
        };
      }
      commitState(next, "centre", action, "imperative");
    },
    setValue(partial, action = {}) {
      if (destroyed) {
        return;
      }
      const next = readValue(partial, value);
      applyValue(
        locked === undefined ? next : { ...next, aspect: locked },
        action,
        "imperative"
      );
    },
    setZoom(zoom, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const k = cropper.getZoom() / Math.min(Math.max(zoom, 1), zoomCap());
      const turned = turnedSize(state.image, state.turns);
      const anchor = action.anchor
        ? {
            x: (action.anchor.x - 0.5) * turned.width,
            y: (action.anchor.y - 0.5) * turned.height,
          }
        : state.crop;
      const sized = constrain(
        scaleToMin({
          ...state,
          crop: {
            ...state.crop,
            height: state.crop.height * k,
            width: state.crop.width * k,
          },
        }),
        "size"
      ).crop;
      const reached = sized.width / state.crop.width;
      const next = {
        ...state,
        crop: {
          height: sized.height,
          width: sized.width,
          x: anchor.x + (state.crop.x - anchor.x) * reached,
          y: anchor.y + (state.crop.y - anchor.y) * reached,
        },
      };
      commitState(next, "size", action, "imperative");
    },
    stop() {
      if (destroyed) {
        return;
      }
      if (gesture) {
        cropper.end(undefined, gesture.owner);
      }
      tasks.clear();
      settlePending = false;
      unschedule();
      flush();
      settleCommit();
      const time = lastTime ?? 0;
      lastTime = null;
      refresh();
      emit("stop");
      emitFrame(time);
    },
    subscribe: (listener) => join(subscribers, listener),
  };

  listeners.change.add((next, details) =>
    options.onValueChange?.(next, details)
  );
  listeners.commit.add((next, details) =>
    options.onValueCommit?.(next, details)
  );
  if (image) {
    const startImage = image;
    image = null;
    cropper.setImage(startImage);
  }
  for (const plugin of initial.plugins ?? []) {
    plugin.init(cropper);
  }
  return cropper;
};
