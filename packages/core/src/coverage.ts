export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The smallest scale for an image rotated by `angle` radians so that a centred
 * crop of size `crop` sees no empty corners.
 */
export const coverScale = (image: Size, crop: Size, angle: number): number => {
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return Math.max(
    (crop.width * cos + crop.height * sin) / image.width,
    (crop.width * sin + crop.height * cos) / image.height
  );
};

/**
 * Whether a centred crop of size `crop` lies fully inside the image rotated by
 * `angle` radians and scaled by `scale`.
 */
export const covers = (
  image: Size,
  crop: Size,
  angle: number,
  scale: number,
  epsilon = 1e-9
): boolean => {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
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
