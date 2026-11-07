import type { ChangeDetails, CommitDetails, CropValue } from "@zriz/react";

type Knobs = {
  dir: "ltr" | "rtl";
  disabled: boolean;
  horizontal: number;
  maxZoom: number;
  motion: "always" | "auto" | "reduce";
  recenterDelay: number;
  rotateGesture: boolean;
  shape: "circle" | "rect";
  vertical: number;
  wheel: "none" | "pan" | "zoom";
};

type KnobName = keyof Knobs;

type KnobValue = boolean | number | string;

type LogRow = {
  event: string;
  id: number;
  move: string | null;
  time: string;
};

type PlaygroundState = {
  knobs: Knobs;
  rows: readonly LogRow[];
};

type Perspective = CropValue["perspective"];

type Listener = () => void;

type ValueListener = (value: CropValue | null) => void;

const DEFAULT_KNOBS: Knobs = {
  dir: "ltr",
  disabled: false,
  horizontal: 0,
  maxZoom: 15,
  motion: "auto",
  recenterDelay: 300,
  rotateGesture: true,
  shape: "rect",
  vertical: 0,
  wheel: "pan",
};

const KNOB_CHOICES: Partial<Record<KnobName, readonly string[]>> = {
  dir: ["ltr", "rtl"],
  motion: ["auto", "always", "reduce"],
  shape: ["rect", "circle"],
  wheel: ["pan", "zoom", "none"],
};

const LOG_ROWS = 50;

const LEVEL: Perspective = { horizontal: 0, vertical: 0 };

const START: PlaygroundState = {
  knobs: DEFAULT_KNOBS,
  rows: [],
};

const listeners = new Set<Listener>();
const valueListeners = new Set<ValueListener>();

let state = START;
let latest: CropValue | null = null;
let asked: Perspective = LEVEL;
let tilted: Perspective | null = null;
let rows: readonly LogRow[] = [];
let nextId = 0;
let frame = 0;

const isKnob = (name: string): name is KnobName =>
  Object.hasOwn(DEFAULT_KNOBS, name);

const fits = (name: KnobName, value: KnobValue): boolean => {
  const choices = KNOB_CHOICES[name];

  if (choices) {
    return typeof value === "string" && choices.includes(value);
  }

  return typeof value === typeof DEFAULT_KNOBS[name];
};

const emit = (next: PlaygroundState): void => {
  state = next;

  for (const listener of listeners) {
    listener();
  }
};

const samePerspective = (a: Perspective, b: Perspective): boolean =>
  a.vertical === b.vertical && a.horizontal === b.horizontal;

const flush = (): void => {
  frame = 0;

  const value = latest;
  const knobs =
    tilted === null || samePerspective(tilted, state.knobs)
      ? state.knobs
      : { ...state.knobs, ...tilted };

  tilted = null;

  if (rows !== state.rows || knobs !== state.knobs) {
    emit({ ...state, knobs, rows });
  }

  for (const listener of valueListeners) {
    listener(value);
  }
};

const schedule = (): void => {
  if (frame === 0 && typeof requestAnimationFrame === "function") {
    frame = requestAnimationFrame(flush);
  }
};

const pad = (part: number): string => String(part).padStart(2, "0");

const clock = (): string => {
  const now = new Date();

  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(pad)
    .join(":");
};

const push = (event: string, move: string | null): void => {
  const [top] = rows;
  const time = clock();

  if (move !== null && top?.move === move) {
    rows = [{ ...top, time }, ...rows.slice(1)];
  } else {
    nextId += 1;
    rows = [{ event, id: nextId, move, time }, ...rows].slice(0, LOG_ROWS);
  }

  schedule();
};

const degrees = (angle: number): string => `${Math.round(angle) || 0}°`;

const playground = {
  ask: (perspective: Perspective): void => {
    asked = perspective;
  },
  change: (value: CropValue, details: ChangeDetails): void => {
    latest = value;

    if (!samePerspective(value.perspective, asked)) {
      tilted = value.perspective;
    }

    push(
      `${details.reason} ${details.phase}`,
      details.phase === "move" ? details.reason : null
    );
  },
  commit: (value: CropValue, details: CommitDetails): void => {
    latest = value;
    push(`${details.reason} commit ${degrees(value.rotation)}`, null);
  },
  getServerState: (): PlaygroundState => START,
  getState: (): PlaygroundState => state,
  knob: (name: string, knobs: Knobs = state.knobs): KnobValue | undefined =>
    isKnob(name) ? knobs[name] : undefined,
  reset: (): void => {
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    latest = null;
    asked = LEVEL;
    tilted = null;
    rows = [];
    emit(START);

    for (const listener of valueListeners) {
      listener(null);
    }
  },
  set: (name: string, value: KnobValue): void => {
    if (!isKnob(name) || !fits(name, value) || state.knobs[name] === value) {
      return;
    }

    emit({ ...state, knobs: { ...state.knobs, [name]: value } });
  },
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
  subscribeValue: (listener: ValueListener): (() => void) => {
    valueListeners.add(listener);

    return () => {
      valueListeners.delete(listener);
    };
  },
  watchers: (): number => listeners.size + valueListeners.size,
};

export type {
  KnobName,
  KnobValue,
  Knobs,
  LogRow,
  Perspective,
  PlaygroundState,
};
export { DEFAULT_KNOBS, KNOB_CHOICES, playground };
