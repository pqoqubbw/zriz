import type { Cropper } from "../cropper";
import { inverseRubberBand, rubberBand } from "../geometry/band";
import { decay, spring, velocityTracker } from "../motion";
import { positive } from "../value";
import { holdCursor } from "./cursor";
import {
  bindPointers,
  capture,
  claim,
  claimTouch,
  outside,
  pressLost,
  presses,
  targetOf,
  watchLoss,
  windowOf,
} from "./input";
import type { PointerHandlers } from "./input";
import { keyed, numberFormat, sliderAria, sliderKey } from "./slider";
import type { KeyHandlers } from "./slider";
import { isHtml, snap, visualScale } from "./view";

export interface DialOptions {
  gain?: number | undefined;
  slop?: number | undefined;
  tau?: number | undefined;
  dir?: "ltr" | "rtl" | undefined;
  locale?: string | undefined;
  format?: Intl.NumberFormatOptions | undefined;
}

export type DialHandlers = KeyHandlers & PointerHandlers;

type SharedDial = DialState & {
  set: (overshoot: number, dragging: boolean) => void;
  stopSettle: (() => void) | null;
};

export interface DialState {
  overshoot: () => number;
  dragging: () => boolean;
  options: () => DialOptions;
  setOptions: (options: DialOptions) => void;
  onChange: (listener: () => void) => () => void;
}

export const DIAL_TICKS = 41;
export const DIAL_STEP = 2.25;
const GAIN = 4;
const SLOP = 10;
const AXIS_LOCK = 6;
const TAU = 95;
const RETURN_OMEGA = 16;
const STOP_SPEED = 0.5;

const states = new WeakMap<Cropper, SharedDial>();

const dialStateOf = (cropper: Cropper): SharedDial => {
  const existing = states.get(cropper);
  if (existing) {
    return existing;
  }
  let overshoot = 0;
  let dragging = false;
  let options: DialOptions = {};
  const listeners = new Set<() => void>();
  const state: SharedDial = {
    dragging: () => dragging,
    onChange(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    options: () => options,
    overshoot: () => overshoot,
    set(nextOvershoot: number, nextDragging: boolean) {
      const changed = nextDragging !== dragging;
      overshoot = nextOvershoot;
      dragging = nextDragging;
      cropper.invalidate();
      if (changed) {
        for (const listener of listeners) {
          listener();
        }
      }
    },
    setOptions(next: DialOptions) {
      const moved =
        (next.dir === "rtl") !== (options.dir === "rtl") ||
        next.gain !== options.gain;
      options = next;
      if (moved) {
        cropper.invalidate();
      }
    },
    stopSettle: null,
  };
  cropper.on("stop", () => {
    state.stopSettle = null;
    state.set(0, false);
  });
  states.set(cropper, state);
  return state;
};

export const dialState = (cropper: Cropper): DialState => dialStateOf(cropper);

const clamp = (value: number, limit: number): number =>
  Math.min(Math.max(value, -limit), limit);

const tenths = (value: number): number => Math.round(value * 10) / 10 || 0;

export const dialHandlers = (
  cropper: Cropper,
  initial: DialOptions = {},
  element?: () => Element | null
): DialHandlers => {
  const owner = {};
  let releaseCursor: (() => void) | null = null;
  const dial = dialStateOf(cropper);
  dial.setOptions(initial);
  const tracker = velocityTracker();
  let pointer: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let startRotation = 0;
  let engaged = false;
  let locked = false;
  let width = 1;
  let scale = 1;
  let unwatch: (() => void) | null = null;
  let stopGlide: ((event?: Event) => void) | null = null;

  const gain = (): number => positive(dial.options().gain, GAIN);
  const sign = (): number => (dial.options().dir === "rtl" ? -1 : 1);

  const show = (raw: number, dragging: boolean, event: Event): void => {
    dial.stopSettle?.();
    dial.stopSettle = null;
    const limit = cropper.getRotationLimit();
    const value = clamp(raw, limit);
    cropper.setRotation(value, { event, reason: "dial" });
    const over = (raw - value) * gain();
    dial.set(
      over === 0 ? 0 : Math.sign(over) * rubberBand(Math.abs(over), width),
      dragging
    );
  };

  const settleOvershoot = (): void => {
    const over = dial.overshoot();
    if (over === 0) {
      dial.set(0, false);
      return;
    }
    let elapsed = 0;
    dial.stopSettle = cropper.run((_, delta) => {
      elapsed += delta;
      const motion = spring(over, 0, RETURN_OMEGA, 1, elapsed);
      const done =
        Math.abs(motion.value) < 0.1 && Math.abs(motion.velocity) < 1;
      dial.set(done ? 0 : motion.value, false);
      if (done) {
        dial.stopSettle = null;
      }
      return !done;
    }, false);
  };

  const fling = (velocity: number, from: number, event: Event): void => {
    const limit = cropper.getRotationLimit();
    const tau = positive(dial.options().tau, TAU);
    const rest = from + (velocity / 1000) * tau;
    let elapsed = 0;
    const target = clamp(rest, limit);
    const toLimit = rest !== target;
    const land = (): void => {
      stopGlide = null;
      cropper.end(event, owner);
    };
    const stop = cropper.run((_, delta) => {
      elapsed += delta;
      if (toLimit) {
        const motion = spring(
          from - target,
          velocity,
          RETURN_OMEGA,
          1,
          elapsed
        );
        show(target + motion.value, false, event);
        if (
          Math.abs(motion.value) < 0.01 &&
          Math.abs(motion.velocity) < STOP_SPEED
        ) {
          show(target, false, event);
          land();
          return false;
        }
        return true;
      }
      const motion = decay(velocity, tau, elapsed);
      show(from + motion.value, false, event);
      if (Math.abs(motion.velocity) < STOP_SPEED) {
        land();
        return false;
      }
      return true;
    });
    stopGlide = () => {
      stop();
      land();
      settleOvershoot();
    };
    cropper.coast(owner, stopGlide);
  };

  const interrupted = (): void => {
    if (stopGlide) {
      stopGlide = null;
      settleOvershoot();
    }
  };

  const finish = (event: Event | undefined, velocity: number): void => {
    pointer = null;
    releaseCursor?.();
    releaseCursor = null;
    unwatch?.();
    unwatch = null;
    if (!engaged) {
      cropper.end(event, owner);
      return;
    }
    engaged = false;
    if (event && velocity !== 0 && dial.overshoot() === 0) {
      dial.set(0, false);
      fling(velocity, cropper.getValue().rotation, event);
      return;
    }
    cropper.end(event, owner);
    settleOvershoot();
  };

  const lost = (event?: Event): void => {
    if (pointer !== null) {
      finish(event, 0);
    }
  };

  const keys = keyed(
    cropper,
    (event) => {
      if (event.altKey) {
        return null;
      }
      const limit = cropper.getRotationLimit();
      const next =
        event.key === "0"
          ? 0
          : sliderKey(
              event,
              cropper.getValue().rotation,
              1,
              -limit,
              limit,
              sign()
            );
      if (next === undefined) {
        return null;
      }
      return () => {
        interrupted();
        cropper.setRotation(clamp(next, limit), {
          event,
          reason: "keyboard",
        });
      };
    },
    owner,
    () => pointer !== null
  );

  return {
    ...keys,
    onLostPointerCapture(event) {
      if (
        pointer === event.pointerId &&
        event.target === targetOf(event, element)
      ) {
        finish(event, 0);
      }
    },
    onPointerCancel(event) {
      if (pointer === event.pointerId) {
        finish(event, 0);
      }
    },
    onPointerDown(event) {
      claim(event);
      if (pointer !== null || !presses(event) || !cropper.getCropState()) {
        return;
      }
      if (!cropper.begin("dial", event, owner)) {
        return;
      }
      interrupted();
      pointer = event.pointerId;
      startX = event.clientX;
      lastX = startX;
      startY = event.clientY;
      startRotation = cropper.getValue().rotation;
      engaged = false;
      locked = false;
      tracker.reset();
      const target = targetOf(event, element);
      scale = target ? visualScale(target).x : 1;
      width = Math.max((target?.getBoundingClientRect().width ?? 0) / scale, 1);
      unwatch = watchLoss(
        cropper,
        lost,
        (next) => next.pointerId === pointer && outside(target, next),
        target
      );
      if (event.pointerType !== "touch" && target) {
        capture(target, event.pointerId);
        releaseCursor = holdCursor(target);
      }
    },
    onPointerMove(event) {
      if (pointer !== event.pointerId) {
        return;
      }
      if (pressLost(event, targetOf(event, element))) {
        finish(event, 0);
        return;
      }
      if (cropper.rebase(owner)) {
        startRotation = cropper.getValue().rotation;
        startX = lastX;
        tracker.reset();
      }
      lastX = event.clientX;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!engaged) {
        if (
          event.pointerType === "touch" &&
          !locked &&
          Math.hypot(dx, dy) >= AXIS_LOCK
        ) {
          if (Math.abs(dy) > Math.abs(dx)) {
            finish(event, 0);
            return;
          }
          locked = true;
          const target = targetOf(event, element);
          if (target) {
            capture(target, event.pointerId);
          }
        }
        const slop = dial.options().slop ?? SLOP;
        if (Math.abs(dx) < slop) {
          return;
        }
        engaged = true;
        startX += Math.sign(dx) * slop;
        const over = dial.overshoot();
        if (over !== 0) {
          startRotation =
            cropper.getValue().rotation +
            (Math.sign(over) * inverseRubberBand(Math.abs(over), width)) /
              gain();
          startX = event.clientX;
        }
      }
      const samples = event.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 0 ? samples : [event]) {
        tracker.push(
          sample.timeStamp,
          ((sample.clientX - startX) * sign()) / scale
        );
      }
      show(
        startRotation + ((event.clientX - startX) * sign()) / scale / gain(),
        true,
        event
      );
    },
    onPointerUp(event) {
      if (pointer === event.pointerId) {
        finish(event, tracker.velocity(event.timeStamp) / gain());
      }
    },
    release() {
      lost();
      stopGlide?.();
      keys.release();
    },
  };
};

export const dialAria = (
  cropper: Cropper,
  element: HTMLElement,
  options: DialOptions = {}
): (() => void) => {
  const formatter = numberFormat(
    options.locale,
    {
      maximumFractionDigits: 1,
      style: "unit",
      unit: "degree",
      unitDisplay: "long",
    },
    options.format
  );
  return sliderAria(cropper, element, "reset", () => {
    const limit = tenths(cropper.getRotationLimit());
    const { rotation } = cropper.getValue();
    const now = tenths(rotation);
    element.toggleAttribute("data-snapped", rotation === 0);
    return [-limit, limit, now, formatter.format(now && rotation)];
  });
};

export const bindDial = (
  cropper: Cropper,
  element: HTMLElement,
  options: DialOptions = {}
): (() => void) => {
  const offAria = dialAria(cropper, element, options);
  const handlers = dialHandlers(cropper, options);
  const unclaim = claimTouch(element, "pan-y");
  element.setAttribute("role", "slider");
  element.setAttribute("aria-orientation", "horizontal");
  element.tabIndex = 0;
  const offPointers = bindPointers(element, handlers);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target === element) {
      handlers.onKeyDown(event);
    }
  };
  element.addEventListener("keydown", onKeyDown);
  element.addEventListener("keyup", handlers.onKeyUp);
  element.addEventListener("blur", handlers.onBlur);
  const dial = dialState(cropper);
  const sync = (): void => {
    element.toggleAttribute("data-dragging", dial.dragging());
  };
  const offChange = dial.onChange(sync);
  return () => {
    offPointers();
    element.removeEventListener("keydown", onKeyDown);
    element.removeEventListener("keyup", handlers.onKeyUp);
    element.removeEventListener("blur", handlers.onBlur);
    handlers.release();
    offChange();
    offAria();
    unclaim();
    sync();
  };
};

export const tickData = (
  index: number,
  count: number = DIAL_TICKS
): { major: boolean; zero: boolean; fade: number | null } => {
  const middle = (count - 1) / 2;
  const fromEnd = Math.min(index, count - 1 - index);
  return {
    fade: fromEnd < 3 ? fromEnd : null,
    major: (index - middle) % 10 === 0,
    zero: index === middle,
  };
};

export const bindDialTicks = (
  cropper: Cropper,
  strip: HTMLElement,
  count: number = DIAL_TICKS
): (() => void) => {
  const dial = dialState(cropper);
  strip.setAttribute("aria-hidden", "true");
  strip.style.position = "absolute";
  strip.style.top = "0";
  strip.style.bottom = "0";
  strip.style.left = "0";
  strip.style.willChange = "transform";
  const created: HTMLElement[] = [];
  if (strip.children.length === 0) {
    for (let i = 0; i < count; i += 1) {
      created.push(strip.ownerDocument.createElement("span"));
    }
    strip.append(...created);
  }
  const spacing = (): number => positive(dial.options().gain, GAIN) * DIAL_STEP;
  const ticks = [...strip.children].filter(isHtml);
  for (const [i, tick] of ticks.entries()) {
    const data = tickData(i, ticks.length);
    tick.style.position = "absolute";
    tick.style.setProperty("--zriz-tick-index", String(i));
    tick.toggleAttribute("data-major", data.major);
    tick.toggleAttribute("data-zero", data.zero);
    if (data.fade === null) {
      delete tick.dataset.fade;
    } else {
      tick.dataset.fade = String(data.fade);
    }
  }
  const host = strip.parentElement;
  const win = windowOf(strip);
  let centre = 0;
  const measure = (): void => {
    centre = ((host?.clientWidth ?? 0) - (ticks[0]?.offsetWidth ?? 0)) / 2;
    cropper.invalidate();
  };
  const observer = host ? new win.ResizeObserver(measure) : null;
  if (host) {
    observer?.observe(host);
  }
  measure();
  let last = "";
  let gap = 0;
  const write = (): void => {
    if (gap !== spacing()) {
      gap = spacing();
      for (const [i, tick] of ticks.entries()) {
        tick.style.left = `${i * gap}px`;
      }
    }
    const dpr = win.devicePixelRatio || 1;
    const middle = ((ticks.length - 1) / 2) * spacing();
    const sign = dial.options().dir === "rtl" ? -1 : 1;
    const offset =
      centre -
      middle +
      sign *
        (cropper.getValue().rotation * (spacing() / DIAL_STEP) +
          dial.overshoot());
    const next = `translateX(${snap(offset, dpr)}px)`;
    if (next !== last) {
      last = next;
      strip.style.transform = next;
    }
  };
  write();
  const off = cropper.on("frame", write);
  return () => {
    off();
    observer?.disconnect();
    for (const tick of created) {
      tick.remove();
    }
  };
};

export const bindDialValue = (
  cropper: Cropper,
  element: HTMLElement,
  format: (rotation: number) => string = (rotation) =>
    String(Math.round(rotation))
): (() => void) => {
  let last = "";
  const write = (): void => {
    const next = format(cropper.getValue().rotation);
    if (next !== last) {
      last = next;
      element.textContent = next;
    }
  };
  write();
  return cropper.on("frame", write);
};
