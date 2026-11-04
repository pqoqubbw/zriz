import { positiveZero, toQuarterTurns } from "./geometry/angle";
import { turnedSize } from "./geometry/state";
import type { CropState, Point, QuarterTurns, Size } from "./geometry/types";

export type Aspect = "free" | "original" | number;

export interface CropValue {
  center: Point;
  size: { width: number; height: number };
  rotation: number;
  quarterTurns: QuarterTurns;
  mirrored: boolean;
  perspective: { vertical: number; horizontal: number };
  aspect: Aspect;
}

export type ValueField = keyof CropValue;

export const ROTATION_LIMIT = 45;
export const PERSPECTIVE_LIMIT = 30;

export const defaultValue: CropValue = {
  aspect: "free",
  center: { x: 0.5, y: 0.5 },
  mirrored: false,
  perspective: { horizontal: 0, vertical: 0 },
  quarterTurns: 0,
  rotation: 0,
  size: { height: 1, width: 1 },
};

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

export const focalLength = (image: Size, millimetres = 26): number =>
  (millimetres / 36) * Math.max(image.width, image.height);

export const valueToState = (
  value: CropValue,
  image: Size,
  focal: number = focalLength(image)
): CropState => {
  const turned = turnedSize(image, value.quarterTurns);
  return {
    angle: value.rotation,
    aspect: aspectRatio(value.aspect, image, value.quarterTurns),
    crop: {
      height: value.size.height * turned.height,
      width: value.size.width * turned.width,
      x: (value.center.x - 0.5) * turned.width,
      y: (value.center.y - 0.5) * turned.height,
    },
    flip: value.mirrored,
    image,
    perspective: { ...value.perspective, focal },
    turns: value.quarterTurns,
  };
};

const clean = (value: number): number =>
  positiveZero(Math.round(value * 1e12) / 1e12);

export const stateToValue = (state: CropState, aspect: Aspect): CropValue => {
  const turned = turnedSize(state.image, state.turns);
  return {
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
      height: clean(state.crop.height / turned.height),
      width: clean(state.crop.width / turned.width),
    },
  };
};

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
    case "aspect":
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
  typeof value === "object" && value !== null;

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, limit: number): number =>
  positiveZero(Math.min(Math.max(value, -limit), limit));

const positive = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const parseAspect = (value: unknown): Aspect => {
  if (value === "free" || value === "original") {
    return value;
  }
  return positive(value, 0) || "free";
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
  const center = isRecord(raw.center) ? raw.center : {};
  const size = isRecord(raw.size) ? raw.size : {};
  const perspective = isRecord(raw.perspective) ? raw.perspective : {};
  const turns = finite(raw.quarterTurns, 0);
  return {
    aspect: parseAspect(raw.aspect),
    center: {
      x: positiveZero(finite(center.x, 0.5)),
      y: positiveZero(finite(center.y, 0.5)),
    },
    mirrored: raw.mirrored === true,
    perspective: {
      horizontal: clamp(finite(perspective.horizontal, 0), PERSPECTIVE_LIMIT),
      vertical: clamp(finite(perspective.vertical, 0), PERSPECTIVE_LIMIT),
    },
    quarterTurns: toQuarterTurns(Math.round(turns)),
    rotation: clamp(finite(raw.rotation, 0), ROTATION_LIMIT),
    size: {
      height: positive(size.height, 1),
      width: positive(size.width, 1),
    },
  };
};
