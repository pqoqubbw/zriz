import sharp from "sharp";

export const cleanCopy = async (input: Buffer) =>
  await sharp(input, { limitInputPixels: 120_000_000 })
    .rotate()
    .jpeg({ quality: 92 })
    .toBuffer();
