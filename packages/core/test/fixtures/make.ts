import { writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const dir = import.meta.dirname;
const width = 30;
const height = 20;
const raw = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const left = x < width / 2;
    const top = y < height / 2;
    let colour = [255, 255, 255];
    if (top && left) {
      colour = [255, 0, 0];
    } else if (top) {
      colour = [0, 255, 0];
    } else if (left) {
      colour = [0, 0, 255];
    }
    raw.set(colour, (y * width + x) * 3);
  }
}
const base = sharp(raw, { raw: { channels: 3, height, width } });
const expected: Record<
  string,
  { width: number; height: number; topLeft: number[] }
> = {};
for (let orientation = 1; orientation <= 8; orientation += 1) {
  const file = await base
    .clone()
    .jpeg({ quality: 100 })
    .withMetadata({ orientation })
    .toBuffer();
  writeFileSync(path.join(dir, `orient-${orientation}.jpg`), file);
  const upright = await sharp(file)
    .rotate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expected[orientation] = {
    height: upright.info.height,
    topLeft: [...upright.data.subarray(0, 3)],
    width: upright.info.width,
  };
}
writeFileSync(
  path.join(dir, "orient.json"),
  `${JSON.stringify(expected, null, 2)}\n`
);
writeFileSync(
  path.join(dir, "viewbox.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#c33"/></svg>\n'
);
writeFileSync(
  path.join(dir, "fake.heic"),
  Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypheic"),
    Buffer.alloc(64),
  ])
);

writeFileSync(
  path.join(dir, "p3.jpg"),
  await base
    .clone()
    .withIccProfile("p3")
    .jpeg({ chromaSubsampling: "4:4:4", quality: 100 })
    .toBuffer()
);
