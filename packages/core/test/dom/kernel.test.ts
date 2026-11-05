import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { imageKernel } from "../../src/dom/kernel";

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

const RECT = { height: 8, width: 8, x: 0, y: 0 };

const decoded: Bitmap[] = [];
const canvases: FakeCanvas[] = [];
let blind = false;

class FakeCanvas {
  width: number;
  height: number;
  context = blind ? null : { drawImage: () => {} };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    canvases.push(this);
  }

  getContext(): { drawImage: () => void } | null {
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

const blobOf = (...parts: Buffer[]): Blob =>
  new Blob(parts.map((part) => new Uint8Array(part)));

const CUTS = [0.1, 0.25, 0.5, 0.75, 0.9, 0.99];

describe("image kernel", () => {
  beforeEach(() => {
    blind = false;
    decoded.length = 0;
    canvases.length = 0;
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

  it("opens a jpeg with fill bytes before a marker", async () => {
    const file = await jpegWithSegment(Buffer.from([0xff, 0xff, 0xff]));
    const fixed = Buffer.concat([file.subarray(0, 2), file.subarray(4)]);

    await expect(
      imageKernel().decode(blobOf(fixed), 4096)
    ).resolves.toHaveProperty("width", 8);
  });

  it("does not take the end marker of a thumbnail for the end of the jpeg", async () => {
    const thumbnail = Buffer.concat([app1(40), Buffer.from([0xff, 0xd9])]);

    thumbnail.writeUInt16BE(42, 2);
    thumbnail[42] = 0xff;
    thumbnail[43] = 0xd9;
    const file = await jpegWithSegment(thumbnail);
    const part = file.subarray(0, -200);

    await expect(imageKernel().decode(blobOf(part), 4096)).rejects.toThrow(
      "the file is cut off"
    );
  });

  it("stops reading an iso box with a size that goes nowhere", async () => {
    const file = (await FILES.avif?.()) ?? Buffer.alloc(0);
    const stuck = Buffer.alloc(16);

    stuck.writeUInt32BE(1, 0);
    stuck.write("free", 4);
    const result = await imageKernel().decode(blobOf(file, stuck), 4096);

    expect(result.width).toBe(8);
  });

  it.each(Object.keys(FILES).filter((format) => format !== "gif"))(
    "reads the pixel count of a %s from its header",
    async (format) => {
      const file = (await FILES[format]?.()) ?? Buffer.alloc(0);

      await expect(
        imageKernel().decode(blobOf(file), 4096, undefined, PIXELS - 1)
      ).rejects.toThrow(/^zriz:too-large:/u);

      expect(decoded).toHaveLength(0);

      await expect(
        imageKernel().decode(blobOf(file), 4096, undefined, PIXELS)
      ).resolves.toHaveProperty("width", 8);
    }
  );

  it("reads the pixel count of a gif", async () => {
    const file = (await FILES.gif?.()) ?? Buffer.alloc(0);

    await expect(
      imageKernel().decode(blobOf(file), 4096, undefined, PIXELS - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);
  });

  it("counts the largest gif frame, not the screen size in the header", async () => {
    const file = Buffer.from((await FILES.gif?.()) ?? Buffer.alloc(0));

    file.writeUInt16LE(1, 6);
    file.writeUInt16LE(1, 8);

    await expect(
      imageKernel().decode(blobOf(file), 4096, undefined, PIXELS - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);

    expect(decoded).toHaveLength(0);
  });

  it("keeps reading a gif past its extension blocks", async () => {
    const file = Buffer.from((await FILES.gif?.()) ?? Buffer.alloc(0));
    const table = 3 * 2 ** (((file[10] ?? 0) % 8) + 1);
    const at = 13 + table;
    const comment = Buffer.from([0x21, 0xfe, 2, 1, 2, 0]);
    const longer = Buffer.concat([
      file.subarray(0, at),
      comment,
      file.subarray(at),
    ]);

    longer.writeUInt16LE(1, 6);
    longer.writeUInt16LE(1, 8);

    await expect(
      imageKernel().decode(blobOf(longer), 4096, undefined, PIXELS - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);
  });

  it("stops at a gif cut off inside a block", async () => {
    const file = Buffer.from((await FILES.gif?.()) ?? Buffer.alloc(0));

    await expect(
      imageKernel().decode(
        blobOf(file.subarray(0, 14)),
        4096,
        undefined,
        PIXELS
      )
    ).resolves.toHaveProperty("width", 8);
  });

  it.each([
    [
      "little",
      (bytes: Buffer, at: number, v: number) => bytes.writeUInt16LE(v, at),
    ],
    [
      "big",
      (bytes: Buffer, at: number, v: number) => bytes.writeUInt16BE(v, at),
    ],
  ])("reads the pixel count of a %s endian tiff", async (name, put) => {
    const file = Buffer.alloc(8 + 2 + 24 + 4);

    const entry = (at: number, tag: number): void => {
      put(file, at, tag);
      put(file, at + 2, 3);
      put(file, at + (name === "little" ? 4 : 6), 1);
      put(file, at + 8, 16);
    };

    file.write(name === "little" ? "II" : "MM", 0);
    put(file, 2, 42);
    put(file, name === "little" ? 4 : 6, 8);
    put(file, 8, 2);
    entry(10, 256);
    entry(22, 257);

    await expect(
      imageKernel().decode(blobOf(file), 4096, undefined, 255)
    ).rejects.toThrow(/^zriz:too-large:/u);
  });

  it("refuses a tiff over the limit from any of its pages", async () => {
    const tiff = Buffer.alloc(8 + 2 * (2 + 24 + 4));

    const entry = (at: number, tag: number, value: number): void => {
      tiff.writeUInt16LE(tag, at);
      tiff.writeUInt16LE(3, at + 2);
      tiff.writeUInt32LE(1, at + 4);
      tiff.writeUInt16LE(value, at + 8);
    };

    tiff.write("II", 0);
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(2, 8);
    entry(10, 256, 1);
    entry(22, 257, 1);
    tiff.writeUInt32LE(38, 34);
    tiff.writeUInt16LE(2, 38);
    entry(40, 256, 200);
    entry(52, 257, 200);

    await expect(
      imageKernel().decode(blobOf(tiff), 4096, undefined, 100)
    ).rejects.toThrow(/^zriz:too-large:/u);

    expect(decoded).toHaveLength(0);
  });

  it("ends the walk over a tiff whose pages point back at each other", async () => {
    const tiff = Buffer.alloc(8 + 2 + 4);

    tiff.write("II", 0);
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(0, 8);
    tiff.writeUInt32LE(8, 10);

    await expect(
      imageKernel().decode(blobOf(tiff), 4096, undefined, PIXELS)
    ).resolves.toHaveProperty("width", 8);
  });

  it("refuses an image over the limit once decoded when its header gives no count", async () => {
    const file = Buffer.from([0xff, 0x0a, 0, 0, 0, 0, 0, 0]);

    await expect(
      imageKernel().decode(blobOf(file), 4096, undefined, 8 * 8 - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);

    expect(decoded.map(({ closed }) => closed)).toStrictEqual([1]);
  });

  it("reads the pixel count of a bmp stored top down", async () => {
    await expect(
      imageKernel().decode(blobOf(bmp()), 4096, undefined, PIXELS - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);
  });

  it("finds the size of a jpeg behind a large metadata segment", async () => {
    const file = await jpegWithSegment(app1(60_000));

    await expect(
      imageKernel().decode(blobOf(file), 4096, undefined, PIXELS - 1)
    ).rejects.toThrow(/^zriz:too-large:/u);
  });

  it("rejects motion and resample for a preview id it no longer keeps", async () => {
    const kernel = imageKernel();

    await kernel.keep(1, bitmapOf());
    await kernel.release(1);
    const released = "zriz:decode:the preview was released";

    await expect(kernel.motion(1, "image/png")).rejects.toThrow(released);
    await expect(kernel.resample(1, RECT, 8, 8)).rejects.toThrow(released);
    await expect(kernel.motion(2, "image/png")).rejects.toThrow(released);
  });

  it("closes the kept copy on release and on a second keep", async () => {
    const kernel = imageKernel();

    await kernel.keep(1, bitmapOf());
    await kernel.keep(1, bitmapOf());
    expect(decoded.map((bitmap) => bitmap.closed)).toStrictEqual([1, 0]);
    await kernel.release(1);
    expect(decoded.map((bitmap) => bitmap.closed)).toStrictEqual([1, 1]);
  });

  it("leaves a bitmap source open and frees its canvas after a region", async () => {
    const kernel = imageKernel();
    const source = bitmapOf();

    await kernel.region(source, SMALL_RECT, 4, 4);
    expect(source.closed).toBe(0);
    expect(canvases.map((canvas) => canvas.width)).toStrictEqual([0]);
  });

  it("closes what it decoded from a blob after a region", async () => {
    const kernel = imageKernel();

    await kernel.region(new Blob(["x"]), SMALL_RECT, 4, 4);
    expect(decoded[0]?.closed).toBe(1);
  });

  it("frees the canvas and the decode when there is no 2D context", async () => {
    blind = true;
    const kernel = imageKernel();

    await expect(
      kernel.region(new Blob(["x"]), SMALL_RECT, 4, 4)
    ).rejects.toThrow("zriz:decode:no 2D canvas");

    expect(decoded[0]?.closed).toBe(1);
    expect(canvases.map((canvas) => canvas.width)).toStrictEqual([0]);
  });
});
