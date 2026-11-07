import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { imageKernel } from "../../src/dom/kernel";
import { noop } from "../cropper-fixture";

type Bitmap = {
  closed: number;
  width: number;
  height: number;
  close: () => void;
};

const bitmapOf = (width = 8, height = 8): Bitmap => {
  const bitmap: Bitmap = {
    close: () => {
      bitmap.closed += 1;
    },
    closed: 0,
    height,
    width,
  };

  return bitmap;
};

const decoded: Bitmap[] = [];

class FakeCanvas {
  width: number;
  height: number;
  context = { drawImage: noop };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(): { drawImage: () => void } {
    return this.context;
  }
}

const SMALL_RECT = { height: 4, width: 4, x: 0, y: 0 };

const WIDTH = 64;
const HEIGHT = 48;
const PIXELS = WIDTH * HEIGHT;

const noise = (): Buffer => {
  const bytes = Buffer.alloc(PIXELS * 3);
  let seed = 7;

  for (let i = 0; i < bytes.length; i += 1) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    bytes[i] = seed % 256;
  }

  return bytes;
};

const photo = () =>
  sharp(noise(), { raw: { channels: 3, height: HEIGHT, width: WIDTH } });

const FILES: Record<string, () => Promise<Buffer>> = {
  avif: async () => await photo().avif().toBuffer(),
  gif: async () => await photo().gif().toBuffer(),
  jpeg: async () => await photo().jpeg().toBuffer(),
  png: async () => await photo().png().toBuffer(),
  "webp, extended": async () =>
    await photo().withMetadata({ orientation: 3 }).webp().toBuffer(),
  "webp, lossless": async () =>
    await photo().webp({ lossless: true }).toBuffer(),
  "webp, lossy": async () => await photo().webp().toBuffer(),
};

const bmp = (): Buffer => {
  const file = Buffer.alloc(54 + PIXELS * 4);

  file.write("BM");
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(WIDTH, 18);
  file.writeInt32LE(-HEIGHT, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(32, 28);

  return file;
};

const jpegWithSegment = async (segment: Buffer): Promise<Buffer> => {
  const file = await FILES.jpeg?.();

  if (!file) {
    throw new Error("no jpeg");
  }

  return Buffer.concat([file.subarray(0, 2), segment, file.subarray(2)]);
};

const app1 = (size: number): Buffer => {
  const segment = Buffer.alloc(size + 2, 0x61);

  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(size, 2);

  return segment;
};

const tiff = (endian: "little" | "big"): Buffer => {
  const file = Buffer.alloc(8 + 2 + 24 + 4);
  const put = (at: number, v: number): number =>
    endian === "little" ? file.writeUInt16LE(v, at) : file.writeUInt16BE(v, at);

  const entry = (at: number, tag: number): void => {
    put(at, tag);
    put(at + 2, 3);
    put(at + (endian === "little" ? 4 : 6), 1);
    put(at + 8, 16);
  };

  file.write(endian === "little" ? "II" : "MM", 0);
  put(2, 42);
  put(endian === "little" ? 4 : 6, 8);
  put(8, 2);
  entry(10, 256);
  entry(22, 257);

  return file;
};

const HEADERS: [string, () => Promise<Buffer>, number][] = [
  ...Object.entries(FILES).map(
    ([format, make]): [string, () => Promise<Buffer>, number] => [
      format,
      make,
      PIXELS,
    ]
  ),
  ["bmp stored top down", async () => await Promise.resolve(bmp()), PIXELS],
  [
    "jpeg behind a large metadata segment",
    async () => await jpegWithSegment(app1(60_000)),
    PIXELS,
  ],
  [
    "little endian tiff",
    async () => await Promise.resolve(tiff("little")),
    256,
  ],
  ["big endian tiff", async () => await Promise.resolve(tiff("big")), 256],
];

const blobOf = (...parts: Buffer[]): Blob =>
  new Blob(parts.map((part) => new Uint8Array(part)));

const CUTS = [0.1, 0.25, 0.5, 0.75, 0.9, 0.99];

describe("image kernel", () => {
  beforeEach(() => {
    decoded.length = 0;
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);

    vi.stubGlobal(
      "createImageBitmap",
      async (): Promise<Bitmap> =>
        await Promise.resolve().then(() => {
          const bitmap = bitmapOf();

          decoded.push(bitmap);

          return bitmap;
        })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["avif", "jpeg", "png"])(
    "refuses a %s cut short before it decodes",
    async (format) => {
      const file = (await FILES[format]?.()) ?? Buffer.alloc(0);

      await Promise.all(
        CUTS.map(async (cut) => {
          const part = file.subarray(0, Math.floor(file.length * cut));

          await expect(
            imageKernel().decode(blobOf(part), 4096)
          ).rejects.toThrow("zriz:decode:the file is cut off");
        })
      );

      expect(decoded).toHaveLength(0);
    }
  );

  it.each(Object.keys(FILES))(
    "opens a whole %s with data after its end",
    async (format) => {
      const file = (await FILES[format]?.()) ?? Buffer.alloc(0);

      const results = await Promise.all(
        [
          Buffer.from("hello world, this is not a box"),
          Buffer.alloc(9, 0xfe),
          Buffer.alloc(3),
        ].map(
          async (tail) => await imageKernel().decode(blobOf(file, tail), 4096)
        )
      );

      expect(results.map(({ width }) => width)).toStrictEqual([8, 8, 8]);
    }
  );

  it("walks jpeg markers past fill bytes and past the end marker of a thumbnail", async () => {
    const file = await jpegWithSegment(Buffer.from([0xff, 0xff, 0xff]));
    const fixed = Buffer.concat([file.subarray(0, 2), file.subarray(4)]);

    await expect(
      imageKernel().decode(blobOf(fixed), 4096)
    ).resolves.toHaveProperty("width", 8);

    const thumbnail = Buffer.concat([app1(40), Buffer.from([0xff, 0xd9])]);

    thumbnail.writeUInt16BE(42, 2);
    thumbnail[42] = 0xff;
    thumbnail[43] = 0xd9;
    const whole = await jpegWithSegment(thumbnail);
    const part = whole.subarray(0, -200);

    await expect(imageKernel().decode(blobOf(part), 4096)).rejects.toThrow(
      "the file is cut off"
    );
  });

  it("ends the walk over an iso box that goes nowhere and tiff pages that loop", async () => {
    const file = (await FILES.avif?.()) ?? Buffer.alloc(0);
    const stuck = Buffer.alloc(16);

    stuck.writeUInt32BE(1, 0);
    stuck.write("free", 4);

    await expect(
      imageKernel().decode(blobOf(file, stuck), 4096)
    ).resolves.toHaveProperty("width", 8);

    const loop = Buffer.alloc(8 + 2 + 4);

    loop.write("II", 0);
    loop.writeUInt16LE(42, 2);
    loop.writeUInt32LE(8, 4);
    loop.writeUInt16LE(0, 8);
    loop.writeUInt32LE(8, 10);

    await expect(
      imageKernel().decode(blobOf(loop), 4096, undefined, PIXELS)
    ).resolves.toHaveProperty("width", 8);
  });

  it.each(HEADERS)(
    "reads the pixel count of a %s from its header",
    async (_name, make, pixels) => {
      const file = await make();

      await expect(
        imageKernel().decode(blobOf(file), 4096, undefined, pixels - 1)
      ).rejects.toThrow(/^zriz:too-large:/u);

      expect(decoded).toHaveLength(0);

      await expect(
        imageKernel().decode(blobOf(file), 4096, undefined, pixels)
      ).resolves.toHaveProperty("width", 8);
    }
  );

  it("counts the largest gif frame past its extension blocks, and stops at a cut inside a block", async () => {
    const file = Buffer.from((await FILES.gif?.()) ?? Buffer.alloc(0));
    const table = 3 * 2 ** (((file[10] ?? 0) % 8) + 1);
    const at = 13 + table;
    const comment = Buffer.from([0x21, 0xfe, 2, 1, 2, 0]);
    const longer = Buffer.concat([
      file.subarray(0, at),
      comment,
      file.subarray(at),
    ]);
    const cut = Buffer.from(file.subarray(0, 14));

    for (const screen of [file, longer]) {
      screen.writeUInt16LE(1, 6);
      screen.writeUInt16LE(1, 8);
    }

    await Promise.all(
      [file, longer].map(async (screen) => {
        await expect(
          imageKernel().decode(blobOf(screen), 4096, undefined, PIXELS - 1)
        ).rejects.toThrow(/^zriz:too-large:/u);
      })
    );

    expect(decoded).toHaveLength(0);

    await expect(
      imageKernel().decode(blobOf(cut), 4096, undefined, PIXELS)
    ).resolves.toHaveProperty("width", 8);
  });

  it("refuses a tiff over the limit from any of its pages", async () => {
    const pages = Buffer.alloc(8 + 2 * (2 + 24 + 4));

    const entry = (at: number, tag: number, value: number): void => {
      pages.writeUInt16LE(tag, at);
      pages.writeUInt16LE(3, at + 2);
      pages.writeUInt32LE(1, at + 4);
      pages.writeUInt16LE(value, at + 8);
    };

    pages.write("II", 0);
    pages.writeUInt16LE(42, 2);
    pages.writeUInt32LE(8, 4);
    pages.writeUInt16LE(2, 8);
    entry(10, 256, 1);
    entry(22, 257, 1);
    pages.writeUInt32LE(38, 34);
    pages.writeUInt16LE(2, 38);
    entry(40, 256, 200);
    entry(52, 257, 200);

    await expect(
      imageKernel().decode(blobOf(pages), 4096, undefined, 100)
    ).rejects.toThrow(/^zriz:too-large:/u);

    expect(decoded).toHaveLength(0);
  });

  it("refuses an image over the limit once decoded when its header gives no count", async () => {
    const file = Buffer.from([0xff, 0x0a, 0, 0, 0, 0, 0, 0]);

    await expect(
      imageKernel().decode(blobOf(file), 4096, undefined, 8 * 8 - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);

    expect(decoded.map(({ closed }) => closed)).toStrictEqual([1]);
  });

  it("leaves a bitmap source open after a region", async () => {
    const kernel = imageKernel();
    const source = bitmapOf();

    await kernel.region(source, SMALL_RECT, 4, 4);
    expect(source.closed).toBe(0);
  });
});
