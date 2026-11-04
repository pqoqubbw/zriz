import type { Size } from "./geometry/types";

export type { Size } from "./geometry/types";

export const coverScale = (
  image: Size,
  crop: Size,
  radians: number
): number => {
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return Math.max(
    (crop.width * cos + crop.height * sin) / image.width,
    (crop.width * sin + crop.height * cos) / image.height
  );
};

export const covers = (
  image: Size,
  crop: Size,
  radians: number,
  scale: number,
  epsilon = 1e-9
): boolean => {
  const cos = Math.cos(-radians);
  const sin = Math.sin(-radians);
  const halfWidth = (image.width * scale) / 2;
  const halfHeight = (image.height * scale) / 2;
  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const x = (sx * crop.width) / 2;
    const y = (sy * crop.height) / 2;
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    if (
      Math.abs(rx) > halfWidth + epsilon ||
      Math.abs(ry) > halfHeight + epsilon
    ) {
      return false;
    }
  }
  return true;
};
