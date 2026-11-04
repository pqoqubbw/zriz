export type Point = {
  x: number;
  y: number;
};

export type Size = {
  readonly width: number;
  readonly height: number;
};

export type Matrix2 = [number, number, number, number];

export type Matrix3 = [
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

export type AffineMatrix = [number, number, number, number, number, number];

export type QuarterTurns = 0 | 1 | 2 | 3;

export type HalfPlane = {
  nx: number;
  ny: number;
  d: number;
};

export type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Perspective = {
  vertical: number;
  horizontal: number;
  focal: number;
};

export type CropState = {
  readonly image: Size;
  readonly turns: QuarterTurns;
  readonly flip: boolean;
  readonly angle: number;
  readonly crop: Readonly<Crop>;
  readonly aspect: number | null;
  readonly perspective: Readonly<Perspective>;
};

export type PixelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
