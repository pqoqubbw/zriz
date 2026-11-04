export interface Point {
  x: number;
  y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

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

export interface HalfPlane {
  nx: number;
  ny: number;
  d: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Perspective {
  vertical: number;
  horizontal: number;
  focal: number;
}

export interface CropState {
  readonly image: Size;
  readonly turns: QuarterTurns;
  readonly flip: boolean;
  readonly angle: number;
  readonly crop: Readonly<Crop>;
  readonly aspect: number | null;
  readonly perspective: Readonly<Perspective>;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
