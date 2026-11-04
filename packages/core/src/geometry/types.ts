type Point = {
  x: number;
  y: number;
};

type Size = {
  readonly width: number;
  readonly height: number;
};

type Matrix2 = [number, number, number, number];

type Matrix3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type AffineMatrix = [number, number, number, number, number, number];

type QuarterTurns = 0 | 1 | 2 | 3;

type HalfPlane = {
  nx: number;
  ny: number;
  d: number;
};

type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Perspective = {
  vertical: number;
  horizontal: number;
  focal: number;
};

type CropState = {
  readonly image: Size;
  readonly turns: QuarterTurns;
  readonly flip: boolean;
  readonly angle: number;
  readonly crop: Readonly<Crop>;
  readonly aspect: number | null;
  readonly perspective: Readonly<Perspective>;
};

type PixelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type {
  AffineMatrix,
  Crop,
  CropState,
  HalfPlane,
  Matrix2,
  Matrix3,
  Perspective,
  PixelRect,
  Point,
  QuarterTurns,
  Rect,
  Size,
};
