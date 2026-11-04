import { positiveZero, toQuarterTurns } from "./angle";
import {
  applyHomography,
  applyMatrix2,
  invertMatrix3,
  multiplyMatrix2,
  orientationMatrix,
  rotationMatrix,
  transposeMatrix2,
} from "./matrix";
import { isFlatPerspective, perspectiveHomography } from "./perspective";
import type { CropState, Matrix2, Point, QuarterTurns, Size } from "./types";

const QUARTER_TURN_VALUES: ReadonlySet<unknown> = new Set([0, 1, 2, 3]);

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

const linearTransform = (
  state: Pick<CropState, "turns" | "flip" | "angle">
): Matrix2 =>
  multiplyMatrix2(
    rotationMatrix(state.angle),
    orientationMatrix(state.turns, state.flip)
  );

const turnedSize = (image: Size, turns: number): Size =>
  turns % 2 === 0 ? image : { height: image.width, width: image.height };

const sourceToWorking = (state: CropState, point: Point): Point => {
  let centred = {
    x: point.x - state.image.width / 2,
    y: point.y - state.image.height / 2,
  };

  if (!isFlatPerspective(state.perspective)) {
    centred = applyHomography(
      perspectiveHomography(state.perspective),
      centred
    );
  }

  return applyMatrix2(
    rotationMatrix(state.angle),
    applyMatrix2(orientationMatrix(state.turns, state.flip), centred)
  );
};

const workingToSource = (state: CropState, point: Point): Point => {
  let keystoned = applyMatrix2(
    transposeMatrix2(orientationMatrix(state.turns, state.flip)),
    applyMatrix2(rotationMatrix(-state.angle), point)
  );

  if (!isFlatPerspective(state.perspective)) {
    keystoned = applyHomography(
      invertMatrix3(perspectiveHomography(state.perspective)),
      keystoned
    );
  }

  return {
    x: keystoned.x + state.image.width / 2,
    y: keystoned.y + state.image.height / 2,
  };
};

const rotateRight = (state: CropState): CropState => ({
  ...state,
  aspect: state.aspect === null ? null : 1 / state.aspect,
  crop: {
    height: state.crop.width,
    width: state.crop.height,
    x: positiveZero(-state.crop.y),
    y: positiveZero(state.crop.x),
  },
  turns: toQuarterTurns(state.turns + 1),
});

const rotateLeft = (state: CropState): CropState => ({
  ...state,
  aspect: state.aspect === null ? null : 1 / state.aspect,
  crop: {
    height: state.crop.width,
    width: state.crop.height,
    x: positiveZero(state.crop.y),
    y: positiveZero(-state.crop.x),
  },
  turns: toQuarterTurns(state.turns + 3),
});

const mirrorX = (state: CropState): CropState => ({
  ...state,
  angle: positiveZero(-state.angle),
  crop: { ...state.crop, x: positiveZero(-state.crop.x) },
  flip: !state.flip,
  turns: toQuarterTurns(4 - state.turns),
});

const mirrorY = (state: CropState): CropState => ({
  ...state,
  angle: positiveZero(-state.angle),
  crop: { ...state.crop, y: positiveZero(-state.crop.y) },
  flip: !state.flip,
  turns: toQuarterTurns(6 - state.turns),
});

const setAngle = (state: CropState, angle: number): CropState => {
  const centre = applyMatrix2(rotationMatrix(angle - state.angle), state.crop);

  return {
    ...state,
    angle: positiveZero(angle),
    crop: {
      ...state.crop,
      x: positiveZero(centre.x),
      y: positiveZero(centre.y),
    },
  };
};

const serialiseState = (state: CropState): string => JSON.stringify(state);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCropState = (value: unknown): value is CropState =>
  isRecord(value) &&
  isRecord(value.image) &&
  isRecord(value.crop) &&
  isRecord(value.perspective) &&
  typeof value.angle === "number" &&
  typeof value.flip === "boolean" &&
  QUARTER_TURN_VALUES.has(value.turns) &&
  (value.aspect === null || typeof value.aspect === "number");

const deserialiseState = (json: string): CropState | null => {
  const value: unknown = JSON.parse(json);

  return isCropState(value) ? value : null;
};

export type { ExifOrientation };
export {
  deserialiseState,
  EXIF_ORIENTATIONS as exifOrientations,
  linearTransform,
  mirrorX,
  mirrorY,
  rotateLeft,
  rotateRight,
  serialiseState,
  setAngle,
  sourceToWorking,
  turnedSize,
  workingToSource,
};
