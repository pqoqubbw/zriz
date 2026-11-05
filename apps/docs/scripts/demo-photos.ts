import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

import {
  DEMO_PHOTO_BUDGET,
  DEMO_PHOTO_LONG_EDGE,
  DEMO_PHOTO_QUALITY,
  DEMO_PHOTOS,
} from "../lib/demo-photos.ts";
import type { DemoPhoto } from "../lib/demo-photos.ts";

const sha256 = (bytes: Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

const sources = process.argv.at(2);

if (sources === undefined) {
  process.stderr.write(
    "usage: node scripts/demo-photos.ts <folder with landscape.jpg and portrait.jpg>\n"
  );

  process.exit(1);
}

const out = path.resolve(import.meta.dirname, "../public/demo");

const convert = async (photo: DemoPhoto): Promise<string> => {
  const input = readFileSync(path.resolve(sources, `${photo.name}.jpg`));

  if (sha256(input) !== photo.source.sha256) {
    throw new Error(
      `${photo.name}.jpg is not the file at ${photo.source.file}`
    );
  }

  const output = await sharp(input)
    .extract(photo.source.crop)
    .resize({
      fit: "inside",
      height: DEMO_PHOTO_LONG_EDGE,
      width: DEMO_PHOTO_LONG_EDGE,
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .webp({ effort: 6, quality: DEMO_PHOTO_QUALITY, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  if (output.info.size > DEMO_PHOTO_BUDGET) {
    throw new Error(
      `${photo.name}.webp is ${output.info.size} B, over ${DEMO_PHOTO_BUDGET} B`
    );
  }

  writeFileSync(path.resolve(out, `${photo.name}.webp`), output.data);

  return `${photo.name}: ${output.info.width}x${output.info.height} ${output.info.size} B ${sha256(output.data)}\n`;
};

mkdirSync(out, { recursive: true });

const lines = await Promise.all(Object.values(DEMO_PHOTOS).map(convert));

process.stdout.write(lines.join(""));
