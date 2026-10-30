"use client";

import { coverScale } from "@zriz/core";
import type { Size } from "@zriz/core";

export interface UseCoverScaleOptions {
  /**
   * Natural size of the image in pixels.
   */
  image: Size;
  /**
   * Size of the crop area in the same units as the image.
   */
  crop: Size;
  /**
   * Straighten angle in degrees.
   * @default 0
   */
  rotation?: number;
}

/**
 * Returns the smallest scale for the rotated image that keeps the crop area free of empty corners.
 */
export const useCoverScale = ({
  image,
  crop,
  rotation = 0,
}: UseCoverScaleOptions): number =>
  coverScale(image, crop, (rotation * Math.PI) / 180);
