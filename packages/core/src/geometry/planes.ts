import { sinCosDegrees } from "./angle";
import { isFlatPerspective } from "./perspective";
import { sourceToWorking, turnedSize, workingToSource } from "./state";
import type { Crop, CropState, HalfPlane, Point } from "./types";

export const imageQuad = (state: CropState): Point[] => {
  const { width, height } = state.image;
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((corner) => sourceToWorking(state, corner));
};

export const polygonPlanes = (vertices: readonly Point[]): HalfPlane[] => {
  const cx =
    vertices.reduce((sum, vertex) => sum + vertex.x, 0) / vertices.length;
  const cy =
    vertices.reduce((sum, vertex) => sum + vertex.y, 0) / vertices.length;
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length] ?? vertex;
    let nx = next.y - vertex.y;
    let ny = vertex.x - next.x;
    const length = Math.hypot(nx, ny);
    nx /= length;
    ny /= length;
    let d = nx * vertex.x + ny * vertex.y;
    if (nx * cx + ny * cy > d) {
      nx = -nx;
      ny = -ny;
      d = -d;
    }
    return { d, nx, ny };
  });
};

export const imagePlanes = (state: CropState): HalfPlane[] => {
  if (!isFlatPerspective(state.perspective)) {
    return polygonPlanes(imageQuad(state));
  }
  const turned = turnedSize(state.image, state.turns);
  const { sin, cos } = sinCosDegrees(state.angle);
  const halfWidth = turned.width / 2;
  const halfHeight = turned.height / 2;
  return [
    { d: halfWidth, nx: cos, ny: sin },
    { d: halfWidth, nx: -cos, ny: -sin },
    { d: halfHeight, nx: -sin, ny: cos },
    { d: halfHeight, nx: sin, ny: -cos },
  ];
};

export const planeSupport = (
  plane: HalfPlane,
  width: number,
  height: number
): number => (width * Math.abs(plane.nx) + height * Math.abs(plane.ny)) / 2;

export const panPlanes = (
  planes: readonly HalfPlane[],
  width: number,
  height: number
): HalfPlane[] =>
  planes.map((plane) => ({
    ...plane,
    d: plane.d - planeSupport(plane, width, height),
  }));

export const insidePlanes = (
  planes: readonly HalfPlane[],
  point: Point,
  epsilon = 0
): boolean =>
  planes.every(
    (plane) => plane.nx * point.x + plane.ny * point.y <= plane.d + epsilon
  );

export const projectOntoPlanes = (
  planes: readonly HalfPlane[],
  given: Point,
  epsilon = 1e-9
): Point => {
  if (insidePlanes(planes, given, epsilon) || Number.isNaN(given.x + given.y)) {
    return given;
  }
  const reach = 1024 * Math.max(1, ...planes.map(({ d }) => Math.abs(d)));
  const point = {
    x: Math.min(Math.max(given.x, -reach), reach),
    y: Math.min(Math.max(given.y, -reach), reach),
  };
  const candidates: Point[] = planes.map((plane) => {
    const k = plane.nx * point.x + plane.ny * point.y - plane.d;
    return { x: point.x - k * plane.nx, y: point.y - k * plane.ny };
  });
  for (const [index, a] of planes.entries()) {
    for (const b of planes.slice(index + 1)) {
      const det = a.nx * b.ny - a.ny * b.nx;
      if (Math.abs(det) >= 1e-14) {
        candidates.push({
          x: (a.d * b.ny - a.ny * b.d) / det,
          y: (a.nx * b.d - a.d * b.nx) / det,
        });
      }
    }
  }
  let best = point;
  let bestExcess = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const excess = Math.max(
      epsilon * 10,
      ...planes.map(
        (plane) => plane.nx * candidate.x + plane.ny * candidate.y - plane.d
      )
    );
    const distance =
      (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
    if (
      excess < bestExcess ||
      (excess === bestExcess && distance < bestDistance)
    ) {
      bestExcess = excess;
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
};

export const cropCorners = (crop: Crop): Point[] => [
  { x: crop.x - crop.width / 2, y: crop.y - crop.height / 2 },
  { x: crop.x + crop.width / 2, y: crop.y - crop.height / 2 },
  { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 },
  { x: crop.x - crop.width / 2, y: crop.y + crop.height / 2 },
];

export const isCropCovered = (state: CropState, epsilon = 1e-9): boolean => {
  const turned = turnedSize(state.image, state.turns);
  const tolerance = epsilon * Math.max(turned.width, turned.height);
  return cropCorners(state.crop).every((corner) => {
    const source = workingToSource(state, corner);
    return (
      source.x >= -tolerance &&
      source.y >= -tolerance &&
      source.x <= state.image.width + tolerance &&
      source.y <= state.image.height + tolerance
    );
  });
};
