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

const PAD = 2;

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
  const [a, b, c, d, e0, f0]: AffineMatrix = plan.forward;
  const e = e0 - (a + c) * PAD;
  const f = f0 - (b + d) * PAD;
  const bx = a * 0.5 + c * 0.5 + e - 0.5;
  const by = b * 0.5 + d * 0.5 + f - 0.5;
  const ix = Math.floor(bx);
  const iy = Math.floor(by);
  const origin = affineOrigin([a, c, b, d], {
    height: image.height + 2 * PAD,
    width: image.width + 2 * PAD,
  });
  return {
    affine: [
      [a, c],
      [b, d],
    ],
    extend: {
      bottom: PAD,
      extendWith: "copy",
      left: PAD,
      right: PAD,
      top: PAD,
    },
    extract: {
      height: plan.height,
      left: -(ix + origin.x),
      top: -(iy + origin.y),
      width: plan.width,
    },
    kind: "affine",
    options: { interpolator: "bicubic", odx: bx - ix, ody: by - iy },
  };
};
