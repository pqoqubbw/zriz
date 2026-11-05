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
import type { CropState, Matrix2, Point, Size } from "./types";

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

export {
  linearTransform,
  mirrorX,
  mirrorY,
  rotateLeft,
  rotateRight,
  setAngle,
  sourceToWorking,
  turnedSize,
  workingToSource,
};
