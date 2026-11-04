import type { ExportPlan } from "./geometry/export-plan";
import type { AffineMatrix, PixelRect, Size } from "./geometry/types";

export interface SharpExtractRecipe {
  readonly kind: "extract";
  readonly extract: PixelRect;
  readonly flop: boolean;
  readonly rotate: number;
}

export interface SharpAffineRecipe {
  readonly kind: "affine";
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
}

export type SharpRecipe = SharpExtractRecipe | SharpAffineRecipe;

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

export const toSharp = (plan: ExportPlan, image: Size): SharpRecipe => {
  if (plan.pixelRect) {
    return {
      extract: plan.pixelRect,
      flop: plan.rotateExpand.flop,
      kind: "extract",
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
  const e = e0 - (a + c) * pad;
  const f = f0 - (b + d) * pad;
  const bx = a * 0.5 + c * 0.5 + e - 0.5;
  const by = b * 0.5 + d * 0.5 + f - 0.5;
  const ix = Math.floor(bx);
  const iy = Math.floor(by);
  const origin = affineOrigin([a, c, b, d], {
    height: image.height + 2 * pad,
    width: image.width + 2 * pad,
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
  };
};
