import { positive } from "../value";
import { applyMatrix2, invertAffine } from "./matrix";
import { isFlatPerspective, perspectiveHomography } from "./perspective";
import { cropCorners } from "./planes";
import { linearTransform, sourceToWorking, workingToSource } from "./state";
import type {
  AffineMatrix,
  Crop,
  CropState,
  Matrix3,
  PixelRect,
} from "./types";

type ExportPlan = {
  width: number;
  height: number;
  forward: AffineMatrix;
  inverse: AffineMatrix;
  homography: Matrix3 | null;
  pixelRect: PixelRect | null;
  rotateExpand: { flop: boolean; degrees: number; dx: number; dy: number };
};

const quantise = (value: number): number => Math.round(value * 1024) / 1024;

const snapEdge = (value: number): number => Math.floor(quantise(value) + 0.5);

const snappedCrop = (
  state: CropState
): { pixelRect: PixelRect; crop: Crop } => {
  const points = cropCorners(state.crop).map((corner) =>
    workingToSource(state, corner)
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(
    state.image.width - 1,
    Math.max(0, snapEdge(Math.min(...xs)))
  );
  const top = Math.min(
    state.image.height - 1,
    Math.max(0, snapEdge(Math.min(...ys)))
  );
  const turned = state.turns % 2 !== 0;
  let sourceWidth =
    Math.min(state.image.width, Math.max(left + 1, snapEdge(Math.max(...xs)))) -
    left;
  let sourceHeight =
    Math.min(state.image.height, Math.max(top + 1, snapEdge(Math.max(...ys)))) -
    top;

  if (state.aspect !== null) {
    const ratio = turned ? 1 / state.aspect : state.aspect;
    const fitHeight = Math.max(1, Math.round(sourceWidth / ratio));
    const fitWidth = Math.max(1, Math.round(sourceHeight * ratio));

    if (fitHeight < sourceHeight) {
      sourceHeight = fitHeight;
    } else if (fitWidth < sourceWidth) {
      sourceWidth = fitWidth;
    }
  }

  const centre = sourceToWorking(state, {
    x: left + sourceWidth / 2,
    y: top + sourceHeight / 2,
  });

  return {
    crop: {
      height: turned ? sourceWidth : sourceHeight,
      width: turned ? sourceHeight : sourceWidth,
      x: centre.x,
      y: centre.y,
    },
    pixelRect: { height: sourceHeight, left, top, width: sourceWidth },
  };
};

const exportPlan = (state: CropState, requestedScale = 1): ExportPlan => {
  const linear = linearTransform(state);
  const hasPerspective = !isFlatPerspective(state.perspective);
  let pixelRect: PixelRect | null = null;
  let { crop } = state;

  if (state.angle === 0 && !hasPerspective) {
    ({ pixelRect, crop } = snappedCrop(state));
  }

  const wanted = positive(requestedScale, 1);
  const scale = Math.max(
    Math.max(crop.width, crop.height) * wanted > Number.MAX_SAFE_INTEGER
      ? 1
      : wanted,
    1 / crop.width,
    1 / crop.height
  );
  const width = Math.max(1, Math.floor(crop.width * scale + 1e-6));
  const height = Math.max(1, Math.floor(crop.height * scale + 1e-6));
  const centre = applyMatrix2(linear, {
    x: state.image.width / 2,
    y: state.image.height / 2,
  });
  const forward: AffineMatrix = [
    linear[0] * scale,
    linear[2] * scale,
    linear[1] * scale,
    linear[3] * scale,
    -scale * (centre.x + crop.x) + width / 2,
    -scale * (centre.y + crop.y) + height / 2,
  ];

  return {
    forward,
    height,
    homography: hasPerspective
      ? perspectiveHomography(state.perspective)
      : null,
    inverse: invertAffine(forward),
    pixelRect,
    rotateExpand: {
      degrees: state.turns * 90 + state.angle,
      dx: crop.x,
      dy: crop.y,
      flop: state.flip,
    },
    width,
  };
};

export type { ExportPlan };
export { exportPlan, quantise, snapEdge };
