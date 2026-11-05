import { positiveZero } from "./angle";
import { planeSupport } from "./planes";
import type { HalfPlane, Point, Size } from "./types";

type Row = readonly [number, number, number];

const minScaleAt = (
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

const flatFit = (
  planes: readonly HalfPlane[],
  view: Size
): { center: Point; scale: number } | null => {
  const [a, b, c, d] = planes;

  if (
    !a ||
    !b ||
    !c ||
    !d ||
    planes.length !== 4 ||
    a.nx !== -b.nx ||
    a.ny !== -b.ny ||
    c.nx !== -d.nx ||
    c.ny !== -d.ny ||
    Math.abs(a.nx * a.nx + a.ny * a.ny - 1) > 1e-9 ||
    Math.abs(c.nx * c.nx + c.ny * c.ny - 1) > 1e-9 ||
    Math.abs(a.nx * c.nx + a.ny * c.ny) > 1e-9
  ) {
    return null;
  }

  const room = (one: HalfPlane, other: HalfPlane): number => {
    const support = planeSupport(one, view.width, view.height);

    return support > 0
      ? (one.d + other.d) / (2 * support)
      : Number.POSITIVE_INFINITY;
  };

  const u = (a.d - b.d) / 2;
  const v = (c.d - d.d) / 2;

  return {
    center: { x: u * a.nx + v * c.nx, y: u * a.ny + v * c.ny },
    scale: 1 / Math.min(room(a, b), room(c, d)),
  };
};

const largestFit = (
  planes: readonly HalfPlane[],
  view: Size
): { center: Point; scale: number } => {
  const flat = flatFit(planes, view);

  if (flat) {
    return flat;
  }

  const rows = planes.map((plane) => ({
    d: plane.d,
    row: [
      plane.nx,
      plane.ny,
      planeSupport(plane, view.width, view.height),
    ] as const,
  }));
  const tolerance = 1e-9 + 1e-12 * Math.max(...planes.map(({ d }) => d));
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
              d + tolerance
          )
        ) {
          best = { center: { x: solution[0], y: solution[1] }, t: solution[2] };
        }
      }
    }
  }

  return { center: best.center, scale: 1 / best.t };
};

export { largestFit, minScaleAt };
