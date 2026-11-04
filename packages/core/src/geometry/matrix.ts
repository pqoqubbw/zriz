import { sinCosDegrees, toQuarterTurns } from "./angle";
import type { AffineMatrix, Matrix2, Matrix3, Point } from "./types";

const IDENTITY_MATRIX3: Readonly<Matrix3> = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const rotationMatrix = (degrees: number): Matrix2 => {
  const { sin, cos } = sinCosDegrees(degrees);

  return [cos, -sin, sin, cos];
};

const quarterTurnMatrix = (turns: number): Matrix2 => {
  const { sin, cos } = sinCosDegrees(90 * toQuarterTurns(turns));

  return [cos + 0, 0 - sin, sin + 0, cos + 0];
};

const multiplyMatrix2 = (a: Matrix2, b: Matrix2): Matrix2 => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
];

const transposeMatrix2 = (a: Matrix2): Matrix2 => [a[0], a[2], a[1], a[3]];

const applyMatrix2 = (a: Matrix2, point: Point): Point => ({
  x: a[0] * point.x + a[1] * point.y,
  y: a[2] * point.x + a[3] * point.y,
});

const orientationMatrix = (turns: number, flip: boolean): Matrix2 =>
  multiplyMatrix2(quarterTurnMatrix(turns), [flip ? -1 : 1, 0, 0, 1]);

const multiplyMatrix3 = (
  a: Readonly<Matrix3>,
  b: Readonly<Matrix3>
): Matrix3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];

const invertMatrix3 = (m: Readonly<Matrix3>): Matrix3 => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const cofactorA = e * i - f * h;
  const cofactorB = -(d * i - f * g);
  const cofactorC = d * h - e * g;
  const det = a * cofactorA + b * cofactorB + c * cofactorC;

  return [
    cofactorA / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    cofactorB / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    cofactorC / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
};

const applyHomography = (h: Readonly<Matrix3>, point: Point): Point => {
  const w = h[6] * point.x + h[7] * point.y + h[8];

  return {
    x: (h[0] * point.x + h[1] * point.y + h[2]) / w,
    y: (h[3] * point.x + h[4] * point.y + h[5]) / w,
  };
};

const invertAffine = (a: AffineMatrix): AffineMatrix => {
  const [m00, m10, m01, m11, tx, ty] = a;
  const det = m00 * m11 - m01 * m10;
  const i00 = m11 / det;
  const i01 = -m01 / det;
  const i10 = -m10 / det;
  const i11 = m00 / det;

  return [i00, i10, i01, i11, -(i00 * tx + i01 * ty), -(i10 * tx + i11 * ty)];
};

const applyAffine = (a: AffineMatrix, point: Point): Point => ({
  x: a[0] * point.x + a[2] * point.y + a[4],
  y: a[1] * point.x + a[3] * point.y + a[5],
});

export {
  IDENTITY_MATRIX3,
  applyAffine,
  applyHomography,
  applyMatrix2,
  invertAffine,
  invertMatrix3,
  multiplyMatrix2,
  multiplyMatrix3,
  orientationMatrix,
  quarterTurnMatrix,
  rotationMatrix,
  transposeMatrix2,
};
