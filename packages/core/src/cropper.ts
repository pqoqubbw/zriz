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
  clean,
  defaultValue,
  focalLength,
  isSound,
  positive,
  readValue,
  sameCrop,
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
  destroy?: () => void;
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
  setZoom: (zoom: number, options?: ActionOptions & { anchor?: Point }) => void;
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
  getMaxZoom: () => number;
  getMinSize: () => Size;
  setCropState: (
    next: CropState,
    options?: ActionOptions & { keep?: "size" | "centre" }
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
}

const sameFields = <T extends object>(a: T, b: T): boolean => {
  for (const key in a) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

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

const noop = (): void => undefined;

const minSide = (given: number | undefined, limit: number): number =>
  Math.min(given !== undefined && given > 0 ? given : 1, limit);

const holdIf = (
  computed: CropValue,
  held: CropValue | undefined,
  size: Size
): CropValue => (held && sameCrop(computed, held, size) ? held : computed);

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
  const tasks = new Map<FrameTask, boolean>();
  const blocking = (): boolean => [...tasks.values()].includes(true);

  const resetValue = readValue(initial.defaultValue ?? {}, defaultValue);
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
    const set = listeners[type];
    const current = [...set];
    for (const listener of current) {
      if (set.has(listener)) {
        attempt(() => {
          Reflect.apply(listener, undefined, args);
        });
      }
    }
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

  const limitAngle = (angle: number): number => {
    const limit = rotationLimit();
    return clean(Math.min(Math.max(angle, -limit), limit));
  };

  const constrain = (next: CropState, keep: "size" | "centre"): CropState => {
    const angle = limitAngle(next.angle);
    const shaped = lengthenLens(
      angle === next.angle ? next : setAngle(next, angle)
    );
    const planes = imagePlanes(shaped);
    const { x, y } = shaped.crop;
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
    const min = minSize(shaped.image);
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
    if (keep === "centre" && insidePlanes(planes, { x, y }, -EPSILON)) {
      const over = Math.min(
        minScaleAt(planes, { height, width }, { x, y }),
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
        narrow !== height / fit < min.height &&
        largestFit(planes, min).scale <= 1 + EPSILON
      ) {
        const open =
          1 /
          largestFit(
            panPlanes(planes, narrow ? min.width : 0, narrow ? 0 : min.height),
            { height: narrow ? 1 : 0, width: narrow ? 0 : 1 }
          ).scale;
        width = narrow ? min.width : open;
        height = narrow ? open : min.height;
      } else {
        width /= fit;
        height /= fit;
      }
    }
    const centre = projectOntoPlanes(
      panPlanes(planes, width, height),
      { x, y },
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

  const refresh = (): void => {
    const next = makeSnapshot();
    if (sameFields(next, snapshot)) {
      return;
    }
    snapshot = next;
    const current = [...subscribers];
    for (const subscriber of current) {
      if (subscribers.has(subscriber)) {
        attempt(subscriber);
      }
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
    const previous = committed;
    committed = value;
    refresh();
    emit("commit", value, {
      event: pending.event,
      pixelCrop: state ? exportPlan(state) : null,
      previous,
      reason: pending.reason,
    });
  };

  const refit = (
    saved: CropState | null,
    savedValue: CropValue
  ): [CropState | null, CropValue] => {
    if (!saved) {
      return [saved, savedValue];
    }
    const fixed = constrain(saved, "centre");
    const fixedValue = stateToValue(fixed, savedValue.aspect);
    return sameCrop(fixedValue, savedValue, saved.image)
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
      if (gesture) {
        gesture.flushed = true;
      }
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
    const sent = value;
    const sentState = state;
    emit("change", sent, details);
    if (canceled) {
      [state, value] = refit(emittedState, emitted);
      emittedState = state;
      emitted = value;
      return;
    }
    emitted = sent;
    emittedState = sentState;
    emit("accept", sent, details);
  };

  const tick = (time: number): void => {
    handle = null;
    const delta = lastTime === null ? 0 : Math.max(0, time - lastTime);
    lastTime = time;
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
      emit("frame", { state, time, value });
    }
    const wasSettling = snapshot.settling;
    settleCommit();
    refresh();
    if (wasSettling && tasks.size === 0) {
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

  const accept = (
    next: CropState | null,
    nextValue: CropValue,
    action: ActionOptions,
    fallback: ChangeReason
  ): void => {
    if (destroyed || (action.reason === "controlled" && gesture !== null)) {
      return;
    }
    if (valuesEqual(value, nextValue)) {
      if (next && next.perspective.focal !== state?.perspective.focal) {
        state = next;
        if (!dirty) {
          emittedState = next;
        }
        frameDirty = true;
        schedule();
      }
      if (action.emit === false && action.reason !== "controlled" && dirty) {
        emitted = value;
        emittedState = state;
        committed = value;
        refresh();
      }
      return;
    }
    state = next;
    value = nextValue;
    frameDirty = true;
    if (action.emit === false) {
      emitted = value;
      emittedState = state;
      committed = value;
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

  const fitReset = (): void => {
    resetFit = image
      ? holdIf(
          stateToValue(
            constrain(fromValue(resetValue, image), "centre"),
            resetValue.aspect
          ),
          resetValue,
          image
        )
      : resetValue;
  };

  const dropHolding = (): void => {
    for (const [task, holds] of tasks) {
      if (holds) {
        tasks.delete(task);
      }
    }
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
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      if (handle !== null) {
        clock.cancel(handle);
        handle = null;
      }
      for (const plugin of initial.plugins ?? []) {
        attempt(() => plugin.destroy?.());
      }
      emit("destroy");
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
    invalidate() {
      frameDirty = true;
      schedule();
    },
    on(type, listener) {
      if (destroyed) {
        return noop;
      }
      const set = listeners[type] as Set<typeof listener>;
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    panBy(dx, dy, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const next = {
        ...state,
        crop: {
          ...state.crop,
          x: state.crop.x + dx * turnedSize(state.image, state.turns).width,
          y: state.crop.y + dy * turnedSize(state.image, state.turns).height,
        },
      };
      commitState(next, "size", action, "pan");
    },
    reset(action = {}) {
      if (disabled()) {
        return;
      }
      applyValue(resetValue, action, "reset");
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
      tasks.set(task, holds);
      schedule();
      refresh();
      return () => {
        if (tasks.delete(task)) {
          schedule();
        }
      };
    },
    setAspect(given, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const aspect = toAspect(given);
      const ratio = aspectRatio(aspect, state.image, state.turns);
      let next: CropState = { ...state, aspect: ratio };
      if (ratio !== null) {
        const planes = imagePlanes(state);
        const unit = { height: 1, width: ratio };
        const centre = { x: state.crop.x, y: state.crop.y };
        const height = insidePlanes(planes, centre, -EPSILON)
          ? 1 / minScaleAt(planes, unit, centre)
          : zoomOf(planes, unit);
        next = {
          ...next,
          crop: { ...state.crop, height, width: height * ratio },
        };
      }
      commitState(next, "centre", action, "aspect", aspect);
    },
    setCropState(next, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const turns = toQuarterTurns(next.turns);
      const given = {
        ...next,
        aspect: aspectRatio(value.aspect, state.image, turns),
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
        frameDirty = true;
        schedule();
        refresh();
        return;
      }
      const fixed = constrain(fromValue(value, next), "centre");
      const fixedValue = holdIf(stateToValue(fixed, value.aspect), value, next);
      if (first) {
        state = fixed;
        value = fixedValue;
        emitted = value;
        emittedState = state;
        committed = value;
        frameDirty = true;
        schedule();
        refresh();
        return;
      }
      emittedState = constrain(fromValue(emitted, next), "centre");
      state = fixed;
      frameDirty = true;
      accept(fixed, fixedValue, {}, "coverage");
      frameDirty = true;
      schedule();
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
      applyValue(readValue(partial, value), action, "imperative");
    },
    setZoom(zoom, action = {}) {
      if (!state || disabled()) {
        return;
      }
      const current = zoomOf(imagePlanes(state), state.crop);
      const target = Math.min(Math.max(zoom, 1), zoomCap());
      const k = current / target;
      const turned = turnedSize(state.image, state.turns);
      const anchor = action.anchor
        ? {
            x: (action.anchor.x - 0.5) * turned.width,
            y: (action.anchor.y - 0.5) * turned.height,
          }
        : { x: state.crop.x, y: state.crop.y };
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
      if (handle !== null) {
        clock.cancel(handle);
        handle = null;
      }
      flush();
      settleCommit();
      lastTime = null;
      refresh();
      emit("stop");
    },
    subscribe(listener) {
      if (destroyed) {
        return noop;
      }
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
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
