import { sinCosDegrees } from "./angle";
import type { Matrix3, Perspective, Size } from "./types";

export const isFlatPerspective = (perspective?: Perspective): boolean =>
  !perspective || (perspective.vertical === 0 && perspective.horizontal === 0);

export const perspectiveHomography = (perspective: Perspective): Matrix3 => {
  const vertical = sinCosDegrees(perspective.vertical);
  const horizontal = sinCosDegrees(perspective.horizontal);

  return [
    horizontal.cos,
    horizontal.sin * vertical.sin,
    0,
    0,
    vertical.cos,
    0,
    -horizontal.sin / perspective.focal,
    (horizontal.cos * vertical.sin) / perspective.focal,
    1,
  ];
};

export const isPerspectiveValid = (
  image: Size,
  perspective: Perspective,
  margin = 0.1
): boolean => {
  const h = perspectiveHomography(perspective);

  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].every(
    ([sx = 0, sy = 0]) =>
      h[6] * ((sx * image.width) / 2) +
        h[7] * ((sy * image.height) / 2) +
        h[8] >
      margin
  );
};
