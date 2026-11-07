import { describe, expect, it } from "vitest";

import { jpegQuality } from "../../src/dom/jpeg-quality";

const LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16,
  24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109,
  103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

const scaled = (quality: number): number[] => {
  const scale = quality < 50 ? 5000 / quality : 200 - quality * 2;

  return LUMA.map((value) =>
    Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100)))
  );
};

const segment = (marker: number, body: number[]): number[] => [
  0xff,
  marker,
  Math.floor((body.length + 2) / 256),
  (body.length + 2) % 256,
  ...body,
];

const jpeg = (...segments: number[][]): Blob =>
  new Blob([new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda])]);

describe("reading the quality of a jpeg", () => {
  it.each([30, 50, 75, 85, 92, 95])(
    "reads quality %i from the luminance table",
    async (quality) => {
      const blob = jpeg(segment(0xdb, [0x00, ...scaled(quality)]));

      await expect(jpegQuality(blob)).resolves.toBeCloseTo(quality / 100, 1);
    }
  );

  it.each([
    [
      "past an app segment and the chroma table",
      () =>
        jpeg(
          segment(
            0xe1,
            Array.from({ length: 5000 }, () => 7)
          ),
          segment(0xdb, [0x01, ...scaled(40), 0x00, ...scaled(80)])
        ),
      0.8,
    ],
    [
      "in a later segment",
      () =>
        jpeg(
          segment(0xdb, [0x01, ...scaled(40)]),
          segment(0xdb, [0x00, ...scaled(80)])
        ),
      0.8,
    ],
    [
      "in a 16 bit table",
      () =>
        jpeg(
          segment(0xdb, [
            0x10,
            ...scaled(70).flatMap((value) => [
              Math.floor(value / 256),
              value % 256,
            ]),
          ])
        ),
      0.7,
    ],
  ])("finds the luminance table %s", async (_name, file, quality) => {
    await expect(jpegQuality(file())).resolves.toBeCloseTo(quality, 1);
  });

  it("gives null for a file that is not a jpeg or has no table", async () => {
    await expect(
      jpegQuality(new Blob([new Uint8Array([1, 2, 3])]))
    ).resolves.toBeNull();

    await expect(jpegQuality(jpeg(segment(0xe0, [0, 0])))).resolves.toBeNull();
  });
});
