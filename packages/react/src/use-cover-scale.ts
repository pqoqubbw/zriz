import { coverScale } from "@zriz/core";
import type { Size } from "@zriz/core";

export type UseCoverScaleOptions = {
  /** Natural image size in pixels. */
  image: Size;
  /** Crop size in image pixels. */
  crop: Size;
  /** Straighten angle in degrees. @default 0 */
  rotation?: number | undefined;
};

export const useCoverScale = ({
  image,
  crop,
  rotation = 0,
}: UseCoverScaleOptions): number =>
  coverScale(image, crop, (rotation * Math.PI) / 180);
