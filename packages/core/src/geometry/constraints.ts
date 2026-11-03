import { rubberBandPoint, rubberBandRange } from "./band";
import { projectOntoPlanes } from "./planes";
import type { HalfPlane, Point, Rect, Size } from "./types";

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface DragLimits {
  planes: readonly HalfPlane[];
  minWidth: number;
  minHeight: number;
  aspect: number | null;
}

const SLOPE_EPSILON = 1e-9;

type XEdge = "x0" | "x1";
type YEdge = "y0" | "y1";

const rectPoints = (rect: Rect): Point[] => [
  { x: rect.x0, y: rect.y0 },
  { x: rect.x1, y: rect.y0 },
  { x: rect.x1, y: rect.y1 },
  { x: rect.x0, y: rect.y1 },
];

const handleSign = (
  handle: CropHandle,
  positive: "e" | "s",
  negative: "w" | "n"
): -1 | 0 | 1 => {
  if (handle.includes(positive)) {
    return 1;
  }
  if (handle.includes(negative)) {
    return -1;
  }
  return 0;
};

const span = (
  sign: number,
  anchor: number,
  centre: number,
  length: number
): [number, number] => {
  if (sign === 0) {
    return [centre - length / 2, centre + length / 2];
  }
  const end = anchor + sign * length;
  return [Math.min(anchor, end), Math.max(anchor, end)];
};

const aspectFamily = (
  start: Rect,
  handle: CropHandle,
  aspect: number
): { at: (height: number) => Rect; desired: (pointer: Point) => number } => {
  const cx = (start.x0 + start.x1) / 2;
  const cy = (start.y0 + start.y1) / 2;
  const sx = handleSign(handle, "e", "w");
  const sy = handleSign(handle, "s", "n");
  let ax = cx;
  if (sx === 1) {
    ax = start.x0;
  } else if (sx === -1) {
    ax = start.x1;
  }
  let ay = cy;
  if (sy === 1) {
    ay = start.y0;
  } else if (sy === -1) {
    ay = start.y1;
  }
  const at = (height: number): Rect => {
    const [x0, x1] = span(sx, ax, cx, aspect * height);
    const [y0, y1] = span(sy, ay, cy, height);
    return { x0, x1, y0, y1 };
  };
  const desired = (pointer: Point): number => {
    if (sx !== 0 && sy !== 0) {
      const dx = sx * aspect;
      const dy = sy;
      return (
        ((pointer.x - ax) * dx + (pointer.y - ay) * dy) / (dx * dx + dy * dy)
      );
    }
    if (sx !== 0) {
      return (sx * (pointer.x - ax)) / aspect;
    }
    return sy * (pointer.y - ay);
  };
  return { at, desired };
};

export const aspectHeightRange = (
  start: Rect,
  handle: CropHandle,
  limits: DragLimits & { aspect: number }
): { min: number; max: number } => {
  const { aspect } = limits;
  const { at } = aspectFamily(start, handle, aspect);
  const r1 = rectPoints(at(1));
  const pairs = rectPoints(at(0)).map(
    (p0, index) => [p0, r1[index] ?? p0] as const
  );
  let min = Math.max(limits.minHeight, limits.minWidth / aspect);
  let max = Number.POSITIVE_INFINITY;
  for (const plane of limits.planes) {
    for (const [p0, p1] of pairs) {
      const base = plane.nx * p0.x + plane.ny * p0.y;
      const slope = plane.nx * p1.x + plane.ny * p1.y - base;
      if (slope > SLOPE_EPSILON) {
        max = Math.min(max, (plane.d - base) / slope);
      } else if (slope < -SLOPE_EPSILON) {
        min = Math.max(min, (plane.d - base) / slope);
      }
    }
  }
  return { max, min };
};

const movingXEdge = (handle: CropHandle): XEdge | null => {
  if (handle.includes("e")) {
    return "x1";
  }
  if (handle.includes("w")) {
    return "x0";
  }
  return null;
};

const movingYEdge = (handle: CropHandle): YEdge | null => {
  if (handle.includes("s")) {
    return "y1";
  }
  if (handle.includes("n")) {
    return "y0";
  }
  return null;
};

const CORNER_EDGES: readonly (readonly [XEdge, YEdge])[] = [
  ["x0", "y0"],
  ["x1", "y0"],
  ["x1", "y1"],
  ["x0", "y1"],
];

const freePlanes = (
  start: Rect,
  movesX: XEdge | null,
  movesY: YEdge | null,
  limits: DragLimits
): HalfPlane[] => {
  const planes: HalfPlane[] = [];
  for (const plane of limits.planes) {
    for (const [xEdge, yEdge] of CORNER_EDGES) {
      const xVaries = xEdge === movesX;
      const yVaries = yEdge === movesY;
      const fixed =
        (xVaries ? 0 : plane.nx * start[xEdge]) +
        (yVaries ? 0 : plane.ny * start[yEdge]);
      const nx = xVaries && Math.abs(plane.nx) > SLOPE_EPSILON ? plane.nx : 0;
      const ny = yVaries && Math.abs(plane.ny) > SLOPE_EPSILON ? plane.ny : 0;
      if (nx !== 0 || ny !== 0) {
        const length = Math.hypot(nx, ny);
        planes.push({
          d: (plane.d - fixed) / length,
          nx: nx / length,
          ny: ny / length,
        });
      }
    }
  }
  if (movesX === "x1") {
    planes.push({ d: -(start.x0 + limits.minWidth), nx: -1, ny: 0 });
  }
  if (movesX === "x0") {
    planes.push({ d: start.x1 - limits.minWidth, nx: 1, ny: 0 });
  }
  if (movesY === "y1") {
    planes.push({ d: -(start.y0 + limits.minHeight), nx: 0, ny: -1 });
  }
  if (movesY === "y0") {
    planes.push({ d: start.y1 - limits.minHeight, nx: 0, ny: 1 });
  }
  return planes;
};

export const dragHandle = (
  start: Rect,
  handle: CropHandle,
  pointer: Point,
  limits: DragLimits,
  bandDistance = 0
): Rect => {
  if (limits.aspect !== null) {
    const { at, desired } = aspectFamily(start, handle, limits.aspect);
    const { min, max } = aspectHeightRange(start, handle, {
      ...limits,
      aspect: limits.aspect,
    });
    const want = desired(pointer);
    return at(
      bandDistance > 0
        ? rubberBandRange(want, min, max, bandDistance)
        : Math.min(Math.max(want, min), Math.max(min, max))
    );
  }
  const movesX = movingXEdge(handle);
  const movesY = movingYEdge(handle);
  const want = { x: movesX ? pointer.x : 0, y: movesY ? pointer.y : 0 };
  const clamped = projectOntoPlanes(
    freePlanes(start, movesX, movesY, limits),
    want
  );
  const shown =
    bandDistance > 0 ? rubberBandPoint(want, clamped, bandDistance) : clamped;
  const out = { ...start };
  if (movesX) {
    out[movesX] = shown.x;
  }
  if (movesY) {
    out[movesY] = shown.y;
  }
  return out;
};

const straightenLimitFor = (side: number, a: number, b: number): number => {
  const radius = Math.hypot(a, b);
  if (radius <= side) {
    return 45;
  }
  const phi = Math.atan2(b, a);
  return Math.max(
    0,
    Math.min(45, ((phi - Math.acos(side / radius)) * 180) / Math.PI)
  );
};

export const straightenLimit = (
  image: Size,
  minWidth: number,
  minHeight: number
): number =>
  Math.min(
    straightenLimitFor(image.width, minWidth, minHeight),
    straightenLimitFor(image.height, minHeight, minWidth)
  );
