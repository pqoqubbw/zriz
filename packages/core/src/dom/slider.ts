import type { ChangeReason, Cropper } from "../cropper";

export interface KeyHandlers {
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onBlur: (event: FocusEvent) => void;
}

export const numberFormat = (
  locale: string | undefined,
  format: Intl.NumberFormatOptions
): Intl.NumberFormat => {
  try {
    return new Intl.NumberFormat(locale, format);
  } catch {
    return new Intl.NumberFormat(undefined, format);
  }
};

export const keyed = (
  cropper: Cropper,
  plan: (event: KeyboardEvent) => (() => void) | null,
  owner: object = {}
): KeyHandlers => {
  let active = false;
  const release = (event: Event): void => {
    if (active) {
      active = false;
      cropper.end(event, owner);
    }
  };
  return {
    onBlur: release,
    onKeyDown(event) {
      const run = plan(event);
      if (!run || !cropper.begin("keyboard", event, owner)) {
        return;
      }
      event.preventDefault();
      active = true;
      run();
    },
    onKeyUp: release,
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

export const sliderAria = (
  cropper: Cropper,
  element: HTMLElement,
  reason: ChangeReason,
  read: () => readonly [number, number, number, string]
): (() => void) => {
  const aria = (): void => {
    const [min, max, now, text] = read();
    element.setAttribute("aria-valuemin", String(min));
    element.setAttribute("aria-valuemax", String(max));
    element.setAttribute("aria-valuenow", String(now));
    element.setAttribute("aria-valuetext", text);
  };
  aria();
  const offCommit = cropper.on("commit", aria);
  const offKeys = cropper.on("accept", (_, details) => {
    if (details.reason === "keyboard" || details.reason === reason) {
      aria();
    }
  });
  return () => {
    offCommit();
    offKeys();
  };
};
