import { sinCosDegrees, toQuarterTurns } from "../../src/geometry/angle";
import {
  applyMatrix2,
  multiplyMatrix3,
  rotationMatrix,
} from "../../src/geometry/matrix";
import {
  isFlatPerspective,
  perspectiveHomography,
} from "../../src/geometry/perspective";
import { cropCorners } from "../../src/geometry/planes";
import {
  linearTransform,
  turnedSize,
  workingToSource,
} from "../../src/geometry/state";
import type {
  AffineMatrix,
  Crop,
  CropState,
  Matrix3,
  Perspective,
  Point,
  QuarterTurns,
  Size,
} from "../../src/geometry/types";

const IDENTITY_MATRIX3: Readonly<Matrix3> = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const absSinCos = (degrees: number): { sin: number; cos: number } => {
  const { sin, cos } = sinCosDegrees(degrees);

  return { cos: Math.abs(cos), sin: Math.abs(sin) };
};

const clamp = (value: number, limit: number): number =>
  Math.min(Math.max(value, -Math.max(limit, 0)), Math.max(limit, 0));

const panBox = (
  image: Size,
  angle: number,
  width: number,
  height: number
): Point => {
  const { sin, cos } = absSinCos(angle);

  return {
    x: (image.width - (width * cos + height * sin)) / 2,
    y: (image.height - (width * sin + height * cos)) / 2,
  };
};

const clampPan = (
  image: Size,
  angle: number,
  width: number,
  height: number,
  centre: Point
): Point => {
  const box = panBox(image, angle, width, height);
  const straightened = applyMatrix2(rotationMatrix(-angle), centre);
  const clamped = {
    x: clamp(straightened.x, box.x),
    y: clamp(straightened.y, box.y),
  };

  if (clamped.x === straightened.x && clamped.y === straightened.y) {
    return centre;
  }

  return applyMatrix2(rotationMatrix(angle), clamped);
};

const coverScaleAt = (
  image: Size,
  view: Size,
  angle: number,
  centre: Point
): number => {
  const { sin, cos } = absSinCos(angle);
  const straightened = applyMatrix2(rotationMatrix(-angle), centre);

  return Math.max(
    (view.width * cos + view.height * sin) /
      (image.width - 2 * Math.abs(straightened.x)),
    (view.width * sin + view.height * cos) /
      (image.height - 2 * Math.abs(straightened.y))
  );
};

const largestCropAt = (
  image: Size,
  angle: number,
  aspect: number,
  centre: Point
): Size => {
  const { sin, cos } = absSinCos(angle);
  const straightened = applyMatrix2(rotationMatrix(-angle), centre);
  const height = Math.min(
    (image.width - 2 * Math.abs(straightened.x)) / (aspect * cos + sin),
    (image.height - 2 * Math.abs(straightened.y)) / (aspect * sin + cos)
  );

  return { height, width: aspect * height };
};

type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const EXIF_ORIENTATIONS: Readonly<
  Record<
    ExifOrientation,
    { readonly turns: QuarterTurns; readonly flip: boolean }
  >
> = {
  1: { flip: false, turns: 0 },
  2: { flip: true, turns: 0 },
  3: { flip: false, turns: 2 },
  4: { flip: true, turns: 2 },
  5: { flip: true, turns: 3 },
  6: { flip: false, turns: 1 },
  7: { flip: true, turns: 1 },
  8: { flip: false, turns: 3 },
};

const sourceToOutputMatrix = (
  state: CropState,
  plan: { width: number; height: number; scale: number; crop: Crop }
): Matrix3 => {
  const linear = linearTransform(state);
  const k = plan.scale;
  const output: Matrix3 = [
    k * linear[0],
    k * linear[1],
    -k * plan.crop.x + plan.width / 2,
    k * linear[2],
    k * linear[3],
    -k * plan.crop.y + plan.height / 2,
    0,
    0,
    1,
  ];
  const homography = isFlatPerspective(state.perspective)
    ? IDENTITY_MATRIX3
    : perspectiveHomography(state.perspective);
  const centre: Matrix3 = [
    1,
    0,
    -state.image.width / 2,
    0,
    1,
    -state.image.height / 2,
    0,
    0,
    1,
  ];

  return multiplyMatrix3(output, multiplyMatrix3(homography, centre));
};

const applyAffine = (a: AffineMatrix, point: Point): Point => ({
  x: a[0] * point.x + a[2] * point.y + a[4],
  y: a[1] * point.x + a[3] * point.y + a[5],
});

const isPerspectiveValid = (
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

const splitAngle = (
  degrees: number
): { turns: QuarterTurns; angle: number } => {
  const turns = Math.round(degrees / 90);

  return { angle: degrees - 90 * turns, turns: toQuarterTurns(turns) };
};

const isCropCovered = (state: CropState, epsilon = 1e-9): boolean => {
  const turned = turnedSize(state.image, state.turns);
  const tolerance = epsilon * Math.max(turned.width, turned.height);

  return cropCorners(state.crop).every((corner) => {
    const source = workingToSource(state, corner);

    return (
      source.x >= -tolerance &&
      source.y >= -tolerance &&
      source.x <= state.image.width + tolerance &&
      source.y <= state.image.height + tolerance
    );
  });
};

export type { ExifOrientation };
export {
  EXIF_ORIENTATIONS as exifOrientations,
  applyAffine,
  clampPan,
  coverScaleAt,
  isCropCovered,
  isPerspectiveValid,
  largestCropAt,
  panBox,
  sourceToOutputMatrix,
  splitAngle,
};
