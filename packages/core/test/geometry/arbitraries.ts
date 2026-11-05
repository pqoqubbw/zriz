import {
  boolean,
  constantFrom,
  double,
  integer,
  oneof,
  record,
} from "fast-check";
import type { Arbitrary } from "fast-check";

import { applyMatrix2, rotationMatrix, turnedSize } from "../../src/geometry";
import type { CropState, QuarterTurns, Size } from "../../src/geometry";
import { largestCropAt, panBox } from "./oracles";

const sizeArb: Arbitrary<Size> = record({
  height: integer({ max: 8000, min: 1 }),
  width: integer({ max: 8000, min: 1 }),
});

const angleArb: Arbitrary<number> = double({
  max: 45,
  min: -45,
  noNaN: true,
}).map((a) => (a === 0 ? 0 : a));

const turnsArb: Arbitrary<QuarterTurns> = constantFrom<QuarterTurns>(
  0,
  1,
  2,
  3
);

const stateArb: Arbitrary<CropState> = record({
  angle: oneof(angleArb, constantFrom(0, 45, -45)),
  aspect: double({ max: 10, min: 0.1, noNaN: true }),
  fill: double({ max: 1, min: 0.05, noNaN: true }),
  flip: boolean(),
  image: sizeArb,
  locked: boolean(),
  pu: double({ max: 1, min: -1, noNaN: true }),
  pv: double({ max: 1, min: -1, noNaN: true }),
  turns: turnsArb,
}).map(
  ({ image, locked, turns, flip, angle, aspect, fill, pu, pv }): CropState => {
    const turned = turnedSize(image, turns);
    const max = largestCropAt(turned, angle, aspect, { x: 0, y: 0 });
    const width = max.width * fill;
    const height = max.height * fill;
    const box = panBox(turned, angle, width, height);
    const m = applyMatrix2(rotationMatrix(angle), {
      x: pu * Math.max(box.x, 0) * 0.999,
      y: pv * Math.max(box.y, 0) * 0.999,
    });

    return {
      angle,
      aspect: locked ? width / height : null,
      crop: { height, width, x: m.x + 0, y: m.y + 0 },
      flip,
      image,
      perspective: { focal: 1, horizontal: 0, vertical: 0 },
      turns,
    };
  }
);

export { angleArb, sizeArb, stateArb, turnsArb };
