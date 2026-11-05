import type { ExportPlan } from "./geometry/export-plan";
import type { AffineMatrix, PixelRect, Size } from "./geometry/types";

type SharpExtractRecipe = {
  readonly kind: "extract";
  readonly extract: PixelRect;
  readonly flop: boolean;
  readonly rotate: number;
  readonly resize: Size;
};

type SharpAffineRecipe = {
  readonly kind: "affine";
  readonly source: PixelRect;
  readonly extend: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly extendWith: "copy";
  };
  readonly affine: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly options: {
    readonly odx: number;
    readonly ody: number;
    readonly interpolator: "bicubic";
  };
  readonly extract: PixelRect;
};

type SharpRecipe = SharpExtractRecipe | SharpAffineRecipe;

const MARGIN = 2;
const SIMILAR = 1e-6;
const NOT_A_PLAN = "zriz: this is not an export plan";

const affineOrigin = (
  m: readonly [number, number, number, number],
  image: Size
): { x: number; y: number } => {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const x of [0, image.width]) {
    for (const y of [0, image.height]) {
      xs.push(m[0] * x + m[1] * y);
      ys.push(m[2] * x + m[3] * y);
    }
  }

  return { x: Math.round(Math.min(...xs)), y: Math.round(Math.min(...ys)) };
};

const toSharp = (plan: ExportPlan, image: Size): SharpRecipe => {
  if (plan.pixelRect) {
    return {
      extract: plan.pixelRect,
      flop: plan.rotateExpand.flop,
      kind: "extract",
      resize: { height: plan.height, width: plan.width },
      rotate: Math.round(plan.rotateExpand.degrees / 90) * 90,
    };
  }

  const { forward, height, width } = plan;

  if (!Array.isArray(forward)) {
    throw new RangeError(NOT_A_PLAN);
  }

  const [a, b, c, d, e0, f0]: AffineMatrix = forward;
  const across = Math.hypot(a, b);
  const pad = Math.ceil(MARGIN / Math.min(1, across));

  if (
    forward.length !== 6 ||
    !forward.every(Number.isFinite) ||
    !(Number.isInteger(width) && Number.isInteger(height)) ||
    width < 1 ||
    height < 1 ||
    Math.abs(Math.hypot(c, d) - across) > SIMILAR * across ||
    Math.abs(a * c + b * d) > SIMILAR * across * across ||
    pad > 2 * Math.min(image.width, image.height) + 1
  ) {
    throw new RangeError(NOT_A_PLAN);
  }

  const det = a * d - b * c;
  const us: number[] = [];
  const vs: number[] = [];

  for (const x of [0, width]) {
    for (const y of [0, height]) {
      us.push((d * (x - e0) - c * (y - f0)) / det);
      vs.push((a * (y - f0) - b * (x - e0)) / det);
    }
  }

  const left = Math.max(0, Math.floor(Math.min(...us)) - MARGIN - 1);
  const top = Math.max(0, Math.floor(Math.min(...vs)) - MARGIN - 1);
  const right = Math.min(image.width, Math.ceil(Math.max(...us)) + MARGIN + 1);
  const bottom = Math.min(
    image.height,
    Math.ceil(Math.max(...vs)) + MARGIN + 1
  );

  if (right <= left || bottom <= top) {
    throw new RangeError(NOT_A_PLAN);
  }

  const source = { height: bottom - top, left, top, width: right - left };
  const e = e0 + a * left + c * top - (a + c) * pad;
  const f = f0 + b * left + d * top - (b + d) * pad;
  const bx = a * 0.5 + c * 0.5 + e - 0.5;
  const by = b * 0.5 + d * 0.5 + f - 0.5;
  const ix = Math.floor(bx);
  const iy = Math.floor(by);
  const origin = affineOrigin([a, c, b, d], {
    height: source.height + 2 * pad,
    width: source.width + 2 * pad,
  });

  return {
    affine: [
      [a, c],
      [b, d],
    ],
    extend: {
      bottom: pad,
      extendWith: "copy",
      left: pad,
      right: pad,
      top: pad,
    },
    extract: {
      height,
      left: -(ix + origin.x),
      top: -(iy + origin.y),
      width,
    },
    kind: "affine",
    options: { interpolator: "bicubic", odx: bx - ix, ody: by - iy },
    source,
  };
};

export type { SharpAffineRecipe, SharpExtractRecipe, SharpRecipe };
export { toSharp };
