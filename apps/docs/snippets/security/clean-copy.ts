import sharp from "sharp";

export const cleanCopy = async (input: Buffer) =>
  await sharp(input, { limitInputPixels: 120_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
