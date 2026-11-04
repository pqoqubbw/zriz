import type { ChangeReason, Cropper } from "../cropper";

export interface KeyHandlers {
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onBlur: (event: FocusEvent) => void;
  release: () => void;
}

export const numberFormat = (
  locale: string | undefined,
  defaults: Intl.NumberFormatOptions & { maximumFractionDigits: number },
  format?: Intl.NumberFormatOptions
): Intl.NumberFormat => {
  const merged = {
    ...defaults,
    maximumFractionDigits: Math.max(
      defaults.maximumFractionDigits,
      format?.minimumFractionDigits ?? 0
    ),
    ...format,
  };
  for (const [tag, options] of [
    [locale, merged],
    [undefined, merged],
    [locale, defaults],
  ] as const) {
    try {
      return new Intl.NumberFormat(tag, options);
    } catch {
      continue;
    }
  }
  return new Intl.NumberFormat(undefined, defaults);
};

export const followDisabled = (
  cropper: Cropper,
  element: Element
): (() => void) => {
  let wrote = false;
  const clear = (): void => {
    if (wrote) {
      wrote = false;
      element.removeAttribute("aria-disabled");
    }
  };
  const sync = (): void => {
    if (!cropper.getState().disabled) {
      clear();
    } else if (!element.hasAttribute("aria-disabled")) {
      wrote = true;
      element.setAttribute("aria-disabled", "true");
    }
  };
  sync();
  const stop = cropper.subscribe(sync);
  return () => {
    stop();
    clear();
  };
};

export const keyed = (
  cropper: Cropper,
  plan: (event: KeyboardEvent) => (() => void) | null,
  owner: object = {},
  busy: () => boolean = () => false
): KeyHandlers => {
  const held = new Set<string>();
  const release = (event?: Event): void => {
    if (held.size > 0) {
      held.clear();
      if (!busy()) {
        cropper.end(event, owner);
      }
    }
  };
  return {
    onBlur: release,
    onKeyDown(event) {
      const run =
        event.ctrlKey || event.metaKey || !cropper.getCropState()
          ? null
          : plan(event);
      if (!run) {
        return;
      }
      if (busy()) {
        event.preventDefault();
        return;
      }
      if (!cropper.begin("keyboard", event, owner)) {
        return;
      }
      event.preventDefault();
      held.add(event.code || event.key);
      run();
    },
    onKeyUp(event) {
      const key = event.code || event.key;
      if (event.key === "Meta") {
        release(event);
      } else if (held.size > 1) {
        held.delete(key);
      } else if (held.has(key)) {
        release(event);
      }
    },
    release,
  };
};

export const sliderKey = (
  event: KeyboardEvent,
  value: number,
  steps: number,
  min: number,
  max: number,
  sign: number
): number | undefined => {
  const step = (event.shiftKey ? 10 : 1) / steps;
  const moves: Partial<Record<string, number>> = {
    ArrowDown: value - step,
    ArrowLeft: value - step * sign,
    ArrowRight: value + step * sign,
    ArrowUp: value + step,
    End: max,
    Home: min,
    PageDown: value - 10 / steps,
    PageUp: value + 10 / steps,
  };
  return moves[event.key];
};

const VALUES = ["min", "max", "now", "text"];

export const sliderAria = (
  cropper: Cropper,
  element: HTMLElement,
  reason: ChangeReason,
  read: () => readonly [number, number, number, string]
): (() => void) => {
  const shown: unknown[] = [];
  const aria = (): void => {
    for (const [index, next] of read().entries()) {
      if (shown[index] !== next) {
        shown[index] = next;
        element.setAttribute(`aria-value${VALUES[index]}`, String(next));
      }
    }
  };
  aria();
  const off = [
    cropper.on("commit", aria),
    cropper.on("settle", aria),
    cropper.on("accept", (_, details) => {
      if (details.reason === "keyboard" || details.reason === reason) {
        aria();
      }
    }),
    cropper.on("frame", () => {
      const { interacting, settling } = cropper.getState();
      if (interacting === null && !settling) {
        aria();
      }
    }),
    followDisabled(cropper, element),
  ];
  return () => {
    for (const stop of off) {
      stop();
    }
  };
};
