import sharp from "sharp";
import type { Sharp } from "sharp";

import type { ExportPlan, Size } from "../../src/geometry";
import { toSharp } from "../../src/to-sharp";

const runSharp = async (
  input: Sharp,
  plan: ExportPlan,
  image: Size
): Promise<Sharp> => {
  const recipe = toSharp(plan, image);

  if (recipe.kind === "extract") {
    const turned = await input
      .extract(recipe.extract)
      .flop(recipe.flop)
      .rotate(recipe.rotate)
      .raw()
      .toBuffer({ resolveWithObject: true });

    return sharp(turned.data, { raw: turned.info }).resize({
      ...recipe.resize,
      fit: "fill",
    });
  }

  const padded = await input
    .extract(recipe.source)
    .extend(recipe.extend)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [[a, b], [c, d]] = recipe.affine;
  const affined = await sharp(padded.data, { raw: padded.info })
    .affine(
      [
        [a, b],
        [c, d],
      ],
      recipe.options
    )
    .raw()
    .toBuffer({ resolveWithObject: true });

  return sharp(affined.data, { raw: affined.info }).extract(recipe.extract);
};

export { runSharp };
