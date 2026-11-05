import { sinCosDegrees } from "./angle";
import type { Matrix3, Perspective } from "./types";

const isFlatPerspective = (perspective?: Perspective): boolean =>
  !perspective || (perspective.vertical === 0 && perspective.horizontal === 0);

const perspectiveHomography = (perspective: Perspective): Matrix3 => {
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

export { isFlatPerspective, perspectiveHomography };
