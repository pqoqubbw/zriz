import type { Cropper } from "../cropper";
import { rubberBand } from "../geometry/band";
import { decay, spring, velocityTracker } from "../motion";
import { holdCursor } from "./cursor";
import { capture, snap } from "./view";

export interface DialOptions {
  gain?: number | undefined;
  slop?: number | undefined;
  tau?: number | undefined;
  dir?: "ltr" | "rtl" | undefined;
  locale?: string | undefined;
  format?: Intl.NumberFormatOptions | undefined;
}

export interface DialHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onPointerCancel: (event: PointerEvent) => void;
  onLostPointerCapture: (event: PointerEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onBlur: (event: FocusEvent) => void;
}

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

const states = new WeakMap<
  Cropper,
  DialState & { set: (o: number, d: boolean) => void }
>();

const dialStateOf = (
  cropper: Cropper
): DialState & { set: (overshoot: number, dragging: boolean) => void } => {
  const existing = states.get(cropper);
  if (existing) {
    return existing;
  }
  let overshoot = 0;
  let dragging = false;
  let options: DialOptions = {};
  const listeners = new Set<() => void>();
  const state = {
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
      options = next;
    },
  };
  states.set(cropper, state);
  return state;
};

export const dialState = (cropper: Cropper): DialState => dialStateOf(cropper);

const clamp = (value: number, limit: number): number =>
  Math.min(Math.max(value, -limit), limit);

const targetOf = (
  event: Event,
  element?: () => Element | null
): Element | null => {
  const own = element?.();
  if (own) {
    return own;
  }
  return event.currentTarget instanceof Element ? event.currentTarget : null;
};

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
  let startRotation = 0;
  let engaged = false;
  let width = 1;
  let stopMotion: (() => void) | null = null;
  let stopSettle: (() => void) | null = null;
  let keyboard = false;

  const gain = (): number => dial.options().gain ?? GAIN;
  const sign = (): number => (dial.options().dir === "rtl" ? -1 : 1);

  const show = (raw: number, dragging: boolean): void => {
    stopSettle?.();
    stopSettle = null;
    const limit = cropper.getRotationLimit();
    const value = clamp(raw, limit);
    cropper.setRotation(value, { reason: "dial" });
    const over = (raw - value) * gain();
    dial.set(
      over === 0 ? 0 : Math.sign(over) * rubberBand(Math.abs(over), width),
      dragging
    );
  };

  const fling = (velocity: number, from: number, event: Event): void => {
    const limit = cropper.getRotationLimit();
    const tau = dial.options().tau ?? TAU;
    const rest = from + (velocity / 1000) * tau;
    let elapsed = 0;
    const target = clamp(rest, limit);
    const toLimit = rest !== target;
    stopMotion = cropper.run((_, delta) => {
      elapsed += delta;
      if (toLimit) {
        const motion = spring(
          from - target,
          velocity,
          RETURN_OMEGA,
          1,
          elapsed
        );
        show(target + motion.value, false);
        if (
          Math.abs(motion.value) < 0.01 &&
          Math.abs(motion.velocity) < STOP_SPEED
        ) {
          show(target, false);
          stopMotion = null;
          cropper.end(event, owner);
          return false;
        }
        return true;
      }
      const motion = decay(velocity, tau, elapsed);
      show(from + motion.value, false);
      if (Math.abs(motion.velocity) < STOP_SPEED) {
        stopMotion = null;
        cropper.end(event, owner);
        return false;
      }
      return true;
    });
  };

  const settleOvershoot = (): void => {
    const over = dial.overshoot();
    if (over === 0) {
      dial.set(0, false);
      return;
    }
    let elapsed = 0;
    stopSettle = cropper.run((_, delta) => {
      elapsed += delta;
      const motion = spring(over, 0, RETURN_OMEGA, 1, elapsed);
      const done =
        Math.abs(motion.value) < 0.1 && Math.abs(motion.velocity) < 1;
      dial.set(done ? 0 : motion.value, false);
      if (done) {
        stopSettle = null;
      }
      return !done;
    }, false);
  };

  const finish = (event: PointerEvent, velocity: number): void => {
    if (pointer !== event.pointerId) {
      return;
    }
    pointer = null;
    releaseCursor?.();
    releaseCursor = null;
    if (!engaged) {
      cropper.end(event, owner);
      return;
    }
    engaged = false;
    if (velocity !== 0 && dial.overshoot() === 0) {
      dial.set(0, false);
      fling(velocity, cropper.getValue().rotation, event);
      return;
    }
    cropper.end(event, owner);
    settleOvershoot();
  };

  const step = (event: KeyboardEvent): number | null => {
    const big = event.shiftKey ? 10 : 1;
    const limit = cropper.getRotationLimit();
    const current = cropper.getValue().rotation;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp": {
        return current + big * (event.key === "ArrowRight" ? sign() : 1);
      }
      case "ArrowLeft":
      case "ArrowDown": {
        return current - big * (event.key === "ArrowLeft" ? sign() : 1);
      }
      case "PageUp": {
        return current + 10;
      }
      case "PageDown": {
        return current - 10;
      }
      case "Home": {
        return -limit;
      }
      case "End": {
        return limit;
      }
      case "0": {
        return 0;
      }
      default: {
        return null;
      }
    }
  };

  return {
    onBlur(event) {
      if (keyboard) {
        keyboard = false;
        cropper.end(event, owner);
      }
    },
    onKeyDown(event) {
      const next = step(event);
      if (next === null) {
        return;
      }
      event.preventDefault();
      if (!keyboard) {
        stopMotion?.();
        if (!cropper.begin("keyboard", event, owner)) {
          return;
        }
        keyboard = true;
      }
      cropper.setRotation(clamp(next, cropper.getRotationLimit()), {
        event,
        reason: "keyboard",
      });
    },
    onKeyUp(event) {
      if (keyboard) {
        keyboard = false;
        cropper.end(event, owner);
      }
    },
    onLostPointerCapture(event) {
      finish(event, 0);
    },
    onPointerCancel(event) {
      finish(event, 0);
    },
    onPointerDown(event) {
      if (
        pointer !== null ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        !cropper.getCropState()
      ) {
        return;
      }
      stopMotion?.();
      stopMotion = null;
      if (!cropper.begin("dial", event, owner)) {
        return;
      }
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startRotation = cropper.getValue().rotation;
      engaged = false;
      tracker.reset();
      const target = targetOf(event, element);
      width = Math.max(target?.getBoundingClientRect().width ?? 0, 1);
      if (event.pointerType !== "touch" && target) {
        capture(target, event.pointerId);
        releaseCursor = holdCursor(target);
      }
    },
    onPointerMove(event) {
      if (pointer !== event.pointerId) {
        return;
      }
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!engaged) {
        if (event.pointerType === "touch" && Math.hypot(dx, dy) >= AXIS_LOCK) {
          if (Math.abs(dy) > Math.abs(dx)) {
            pointer = null;
            cropper.end(event, owner);
            return;
          }
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
      }
      const samples = event.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 0 ? samples : [event]) {
        tracker.push(sample.timeStamp, (sample.clientX - startX) * sign());
      }
      show(startRotation + ((event.clientX - startX) * sign()) / gain(), true);
    },
    onPointerUp(event) {
      finish(event, tracker.velocity(event.timeStamp) / gain());
    },
  };
};

export const dialAria = (
  cropper: Cropper,
  element: HTMLElement,
  options: DialOptions = {}
): (() => void) => {
  const formatter = new Intl.NumberFormat(options.locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "degree",
    unitDisplay: "long",
    ...options.format,
  });
  const aria = (): void => {
    const limit = cropper.getRotationLimit();
    const { rotation } = cropper.getValue();
    element.setAttribute("aria-valuemin", String(-limit));
    element.setAttribute("aria-valuemax", String(limit));
    element.setAttribute("aria-valuenow", String(rotation));
    element.setAttribute("aria-valuetext", formatter.format(rotation));
    element.toggleAttribute("data-snapped", rotation === 0);
  };
  aria();
  const offCommit = cropper.on("commit", aria);
  const offKeys = cropper.on("change", (_, details) => {
    if (details.reason === "keyboard" || details.reason === "reset") {
      aria();
    }
  });
  return () => {
    offCommit();
    offKeys();
  };
};

export const bindDial = (
  cropper: Cropper,
  element: HTMLElement,
  options: DialOptions = {}
): (() => void) => {
  const handlers = dialHandlers(cropper, options);
  element.style.touchAction = "pan-y";
  element.style.userSelect = "none";
  element.setAttribute("role", "slider");
  element.setAttribute("aria-orientation", "horizontal");
  element.tabIndex = 0;
  const events = [
    ["pointerdown", handlers.onPointerDown],
    ["pointermove", handlers.onPointerMove],
    ["pointerup", handlers.onPointerUp],
    ["pointercancel", handlers.onPointerCancel],
    ["lostpointercapture", handlers.onLostPointerCapture],
  ] as const;
  for (const [type, handler] of events) {
    element.addEventListener(type, handler);
  }
  element.addEventListener("keydown", handlers.onKeyDown);
  element.addEventListener("keyup", handlers.onKeyUp);
  element.addEventListener("blur", handlers.onBlur);
  const dial = dialState(cropper);
  const sync = (): void => {
    element.toggleAttribute("data-dragging", dial.dragging());
  };
  const offChange = dial.onChange(sync);
  const offAria = dialAria(cropper, element, options);
  return () => {
    for (const [type, handler] of events) {
      element.removeEventListener(type, handler);
    }
    element.removeEventListener("keydown", handlers.onKeyDown);
    element.removeEventListener("keyup", handlers.onKeyUp);
    element.removeEventListener("blur", handlers.onBlur);
    offChange();
    offAria();
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
  if (strip.children.length === 0) {
    for (let i = 0; i < count; i += 1) {
      strip.append(document.createElement("span"));
    }
  }
  const spacing = (): number => (dial.options().gain ?? GAIN) * DIAL_STEP;
  const ticks = [...strip.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
  for (const [i, tick] of ticks.entries()) {
    const data = tickData(i, ticks.length);
    tick.style.position = "absolute";
    tick.style.left = `${i * spacing()}px`;
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
  let centre = 0;
  const measure = (): void => {
    centre = (host?.getBoundingClientRect().width ?? 0) / 2;
    cropper.invalidate();
  };
  const observer = host ? new ResizeObserver(measure) : null;
  if (host) {
    observer?.observe(host);
  }
  measure();
  let last = "";
  const write = (): void => {
    const dpr = globalThis.devicePixelRatio || 1;
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
