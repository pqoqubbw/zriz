import { positiveZero, sinCosDegrees } from "./angle";
import { applyMatrix2, rotationMatrix } from "./matrix";
import { planeSupport } from "./planes";
import type { HalfPlane, Point, Size } from "./types";

type Row = readonly [number, number, number];

const absSinCos = (degrees: number): { sin: number; cos: number } => {
  const { sin, cos } = sinCosDegrees(degrees);
  return { cos: Math.abs(cos), sin: Math.abs(sin) };
};

export const panBox = (
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

const clamp = (value: number, limit: number): number =>
  Math.min(Math.max(value, -Math.max(limit, 0)), Math.max(limit, 0));

export const clampPan = (
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

export const coverScaleAt = (
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

export const minScaleAt = (
  planes: readonly HalfPlane[],
  view: Size,
  centre: Point
): number =>
  Math.max(
    ...planes.map((plane) => {
      const room = plane.d - (plane.nx * centre.x + plane.ny * centre.y);
      return room > 0
        ? planeSupport(plane, view.width, view.height) / room
        : Number.POSITIVE_INFINITY;
    })
  );

const determinant3 = (a: Row, b: Row, c: Row): number =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) -
  a[1] * (b[0] * c[2] - b[2] * c[0]) +
  a[2] * (b[0] * c[1] - b[1] * c[0]);

const withColumn = (row: Row, column: number, value: number): Row => [
  column === 0 ? value : row[0],
  column === 1 ? value : row[1],
  column === 2 ? value : row[2],
];

const solve3 = (a: Row, b: Row, c: Row, rhs: Row): Row | null => {
  const det = determinant3(a, b, c);
  if (Math.abs(det) < 1e-14) {
    return null;
  }
  const solveColumn = (column: number): number =>
    positiveZero(
      determinant3(
        withColumn(a, column, rhs[0]),
        withColumn(b, column, rhs[1]),
        withColumn(c, column, rhs[2])
      ) / det
    );
  return [solveColumn(0), solveColumn(1), solveColumn(2)];
};

export const largestFit = (
  planes: readonly HalfPlane[],
  view: Size
): { center: Point; scale: number } => {
  const rows = planes.map((plane) => ({
    d: plane.d,
    row: [
      plane.nx,
      plane.ny,
      planeSupport(plane, view.width, view.height),
    ] as const,
  }));
  let best = { center: { x: 0, y: 0 }, t: Number.NEGATIVE_INFINITY };
  for (const [i, a] of rows.entries()) {
    for (const [j, b] of rows.slice(i + 1).entries()) {
      for (const c of rows.slice(i + j + 2)) {
        const solution = solve3(a.row, b.row, c.row, [a.d, b.d, c.d]);
        if (
          solution &&
          solution[2] > best.t &&
          rows.every(
            ({ row, d }) =>
              row[0] * solution[0] +
                row[1] * solution[1] +
                row[2] * solution[2] <=
              d * (1 + 1e-12) + 1e-9
          )
        ) {
          best = { center: { x: solution[0], y: solution[1] }, t: solution[2] };
        }
      }
    }
  }
  return { center: best.center, scale: 1 / best.t };
};

export const largestCropAt = (
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
