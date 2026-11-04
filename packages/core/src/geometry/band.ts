import type { Point } from "./types";

export const RUBBER_BAND_COEFFICIENT = 0.55;

export const rubberBand = (
  overshoot: number,
  distance: number,
  coefficient: number = RUBBER_BAND_COEFFICIENT
): number =>
  overshoot <= 0
    ? overshoot * coefficient
    : (1 - 1 / ((overshoot * coefficient) / distance + 1)) * distance;

export const inverseRubberBand = (
  shown: number,
  distance: number,
  coefficient: number = RUBBER_BAND_COEFFICIENT
): number =>
  shown <= 0
    ? shown / coefficient
    : (distance * shown) / (coefficient * (distance - shown));

export const rubberBandPoint = (
  raw: Point,
  clamped: Point,
  distance: number,
  coefficient: number = RUBBER_BAND_COEFFICIENT
): Point => {
  const ex = raw.x - clamped.x;
  const ey = raw.y - clamped.y;
  const length = Math.hypot(ex, ey);
  if (length === 0) {
    return raw;
  }
  const k = rubberBand(length, distance, coefficient) / length;
  return { x: clamped.x + ex * k, y: clamped.y + ey * k };
};
