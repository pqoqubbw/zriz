import { positiveZero, toQuarterTurns } from "./geometry/angle";
import { turnedSize } from "./geometry/state";
import type { CropState, Point, QuarterTurns, Size } from "./geometry/types";

export type Aspect = "free" | "original" | number;

export interface CropValue {
  readonly center: Readonly<Point>;
  readonly size: Readonly<Size>;
  readonly rotation: number;
  readonly quarterTurns: QuarterTurns;
  readonly mirrored: boolean;
  readonly perspective: {
    readonly vertical: number;
    readonly horizontal: number;
  };
  readonly aspect: Aspect;
}

export type ValueField = keyof CropValue;

export const ROTATION_LIMIT = 45;
export const PERSPECTIVE_LIMIT = 30;
const REACH = 1e6;
const MIN_RATIO = 1e-6;

export const seal = <T extends object>(target: T): T => {
  for (const item of Object.values<unknown>(target)) {
    if (typeof item === "object" && item !== null) {
      seal(item);
    }
  }
  return Object.freeze(target);
};

export const defaultValue: CropValue = seal({
  aspect: "free",
  center: { x: 0.5, y: 0.5 },
  mirrored: false,
  perspective: { horizontal: 0, vertical: 0 },
  quarterTurns: 0,
  rotation: 0,
  size: { height: 1, width: 1 },
});

const fields: readonly ValueField[] = [
  "center",
  "size",
  "rotation",
  "quarterTurns",
  "mirrored",
  "perspective",
  "aspect",
];

export const aspectRatio = (
  aspect: Aspect,
  image: Size,
  turns: number
): number | null => {
  if (aspect === "free") {
    return null;
  }
  if (aspect === "original") {
    const turned = turnedSize(image, turns);
    return turned.width / turned.height;
  }
  return aspect;
};

export const clean = (value: number): number =>
  positiveZero(Math.round(value * 1e12) / 1e12);

const cleanSide = (value: number): number => clean(value) || value;

export const focalLength = (image: Size, millimetres = 26): number =>
  (millimetres / 36) * Math.max(image.width, image.height);

export const valueToState = (
  value: CropValue,
  image: Size,
  focal: number = focalLength(image)
): CropState => {
  const turns = toQuarterTurns(Math.round(value.quarterTurns));
  const turned = turnedSize(image, turns);
  return {
    angle: value.rotation,
    aspect: aspectRatio(value.aspect, image, turns),
    crop: {
      height: value.size.height * turned.height,
      width: value.size.width * turned.width,
      x: (value.center.x - 0.5) * turned.width,
      y: (value.center.y - 0.5) * turned.height,
    },
    flip: value.mirrored,
    image,
    perspective: {
      focal,
      horizontal: clean(value.perspective.horizontal),
      vertical: clean(value.perspective.vertical),
    },
    turns,
  };
};

export const stateToValue = (state: CropState, aspect: Aspect): CropValue => {
  const turned = turnedSize(state.image, state.turns);
  return seal({
    aspect,
    center: {
      x: clean(state.crop.x / turned.width + 0.5),
      y: clean(state.crop.y / turned.height + 0.5),
    },
    mirrored: state.flip,
    perspective: {
      horizontal: clean(state.perspective.horizontal),
      vertical: clean(state.perspective.vertical),
    },
    quarterTurns: state.turns,
    rotation: clean(state.angle),
    size: {
      height: cleanSide(state.crop.height / turned.height),
      width: cleanSide(state.crop.width / turned.width),
    },
  });
};

export const sameAspect = (a: Aspect, b: Aspect): boolean =>
  a === b ||
  (typeof a === "number" &&
    typeof b === "number" &&
    Math.abs(a - b) <= 1e-12 * Math.max(a, b));

const fieldEqual = (a: CropValue, b: CropValue, field: ValueField): boolean => {
  switch (field) {
    case "center": {
      return a.center.x === b.center.x && a.center.y === b.center.y;
    }
    case "size": {
      return a.size.width === b.size.width && a.size.height === b.size.height;
    }
    case "perspective": {
      return (
        a.perspective.vertical === b.perspective.vertical &&
        a.perspective.horizontal === b.perspective.horizontal
      );
    }
    case "aspect": {
      return sameAspect(a.aspect, b.aspect);
    }
    case "mirrored":
    case "quarterTurns":
    case "rotation": {
      return a[field] === b[field];
    }
    default: {
      return false;
    }
  }
};

export const changedFields = (a: CropValue, b: CropValue): ValueField[] =>
  fields.filter((field) => !fieldEqual(a, b, field));

export const valuesEqual = (a: CropValue, b: CropValue): boolean =>
  a === b || fields.every((field) => fieldEqual(a, b, field));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, limit: number): number =>
  positiveZero(Math.min(Math.max(value, -limit), limit));

export const positive = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

export const toAspect = (value: unknown): Aspect => {
  if (value === "free" || value === "original") {
    return value;
  }
  return typeof value === "number" &&
    value >= MIN_RATIO &&
    value <= 1 / MIN_RATIO
    ? value
    : "free";
};

const bound = (value: unknown, fallback: number): number =>
  clamp(finite(value, fallback), REACH);

const side = (value: unknown, fallback: number): number =>
  Math.min(Math.max(positive(value, fallback), 1e-100), REACH);

export const readValue = (
  raw: Partial<CropValue> | Record<string, unknown>,
  base: CropValue
): CropValue => {
  const center = isRecord(raw.center) ? raw.center : {};
  const size = isRecord(raw.size) ? raw.size : {};
  const perspective = isRecord(raw.perspective) ? raw.perspective : {};
  return seal({
    aspect: raw.aspect === undefined ? base.aspect : toAspect(raw.aspect),
    center: {
      x: bound(center.x, base.center.x),
      y: bound(center.y, base.center.y),
    },
    mirrored: typeof raw.mirrored === "boolean" ? raw.mirrored : base.mirrored,
    perspective: {
      horizontal: bound(perspective.horizontal, base.perspective.horizontal),
      vertical: bound(perspective.vertical, base.perspective.vertical),
    },
    quarterTurns: toQuarterTurns(
      Math.round(finite(raw.quarterTurns, base.quarterTurns))
    ),
    rotation: bound(raw.rotation, base.rotation),
    size: {
      height: side(size.height, base.size.height),
      width: side(size.width, base.size.width),
    },
  });
};

const numbersOf = ({
  center,
  perspective,
  rotation,
  size,
}: CropValue): number[] => [
  center.x,
  center.y,
  perspective.horizontal,
  perspective.vertical,
  rotation,
  size.height,
  size.width,
];

export const isSound = (value: CropValue): boolean =>
  numbersOf(value).every(Number.isFinite) &&
  value.size.width > 0 &&
  value.size.height > 0;

export const sameCrop = (a: CropValue, b: CropValue, image: Size): boolean => {
  const reach = Math.min(
    1e-8,
    (2e-8 + 4e-12 * Math.max(image.width, image.height)) /
      Math.min(image.width, image.height)
  );
  const other = numbersOf(b);
  return (
    sameAspect(a.aspect, b.aspect) &&
    a.mirrored === b.mirrored &&
    a.quarterTurns === b.quarterTurns &&
    numbersOf(a).every((n, i) => Math.abs(n - (other[i] ?? 0)) <= reach)
  );
};

export const serialize = (value: CropValue): string =>
  JSON.stringify({ v: 1, ...value });

export const parse = (input: unknown): CropValue | null => {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!isRecord(raw)) {
    return null;
  }
  const read = readValue(raw, defaultValue);
  return {
    ...read,
    perspective: {
      horizontal: clamp(read.perspective.horizontal, PERSPECTIVE_LIMIT),
      vertical: clamp(read.perspective.vertical, PERSPECTIVE_LIMIT),
    },
    rotation: clamp(read.rotation, ROTATION_LIMIT),
  };
};
