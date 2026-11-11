type DecodeReply = {
  width: number;
  height: number;
  preview: ImageBitmap;
};

type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Kernel = {
  decode: (
    blob: Blob,
    edge: number,
    keep?: number,
    maxPixels?: number
  ) => Promise<DecodeReply>;
  keep: (id: number, bitmap: ImageBitmap) => Promise<undefined>;
  motion: (id: number, type: string) => Promise<Blob>;
  resample: (
    id: number,
    rect: Region,
    width: number,
    height: number
  ) => Promise<ImageBitmap>;
  region: (
    source: Blob | ImageBitmap,
    rect: Region,
    width: number,
    height: number
  ) => Promise<ImageBitmap>;
  release: (id: number) => Promise<undefined>;
};

const imageKernel = (): Kernel => {
  type Canvas = OffscreenCanvas | HTMLCanvasElement;
  type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  type Shape = [pixels: number, whole: boolean];

  const fail = (code: string, message: string): Error =>
    new Error(`zriz:${code}:${message}`);

  const canvasFor = (width: number, height: number): Canvas => {
    if (typeof OffscreenCanvas === "function") {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    return canvas;
  };

  const contextOf = (
    canvas: {
      getContext: (
        id: "2d",
        settings: CanvasRenderingContext2DSettings
      ) => Context | null;
    },
    colorSpace: PredefinedColorSpace
  ): Context => {
    const context = canvas.getContext("2d", { colorSpace });

    if (!context) {
      throw fail("decode", "no 2D canvas");
    }

    return context;
  };

  const free = (canvas: Canvas): void => {
    canvas.width = 0;
    canvas.height = 0;
  };

  const encode = async (
    canvas: Canvas,
    type: string,
    quality: number
  ): Promise<Blob> => {
    if ("convertToBlob" in canvas) {
      return await canvas.convertToBlob({ quality, type });
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(fail("blank", "the browser returned no image"));
          }
        },
        type,
        quality
      );
    });
  };

  const decodeFull = async (blob: Blob): Promise<ImageBitmap> => {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw fail("undecodable", "the browser could not decode the file");
    }
  };

  const big = (b: Uint8Array, at: number, size: number): number => {
    let value = 0;

    for (let i = 0; i < size; i += 1) {
      value = value * 256 + (b[at + i] ?? 0);
    }

    return value;
  };

  const little = (b: Uint8Array, at: number, size: number): number => {
    let value = 0;

    for (let i = size - 1; i >= 0; i -= 1) {
      value = value * 256 + (b[at + i] ?? 0);
    }

    return value;
  };

  const png = (b: Uint8Array): Shape => {
    let at = 8;

    while (at + 12 <= b.length && big(b, at + 4, 4) !== 0x49_45_4e_44) {
      at += 12 + big(b, at, 4);
    }

    return [big(b, 16, 4) * big(b, 20, 4), at + 12 <= b.length];
  };

  const isFrame = (marker: number): boolean =>
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc;

  const jpeg = (b: Uint8Array): Shape => {
    let at = 2;
    let pixels = 0;

    while (at + 4 <= b.length && (b[at] !== 0xff || b[at + 1] !== 0xda)) {
      const marker = b[at + 1] ?? 0;

      if (b[at] !== 0xff || marker === 0xff) {
        at += 1;
      } else {
        if (isFrame(marker)) {
          pixels = big(b, at + 5, 2) * big(b, at + 7, 2);
        }

        at += 2 + big(b, at + 2, 2);
      }
    }

    for (; at + 1 < b.length; at += 1) {
      if (b[at] === 0xff && b[at + 1] === 0xd9) {
        return [pixels, true];
      }
    }

    return [pixels, false];
  };

  const boxEnd = (b: Uint8Array, at: number): number => {
    const size = big(b, at, 4);

    if (size === 0) {
      return b.length;
    }

    return at + (size === 1 ? big(b, at + 8, 8) : size);
  };

  const largestItem = (b: Uint8Array, from: number, to: number): number => {
    let most = 0;

    for (let i = from; i + 16 <= to; i += 1) {
      if (big(b, i, 4) === 0x69_73_70_65) {
        most = Math.max(most, big(b, i + 8, 4) * big(b, i + 12, 4));
      }
    }

    return most;
  };

  const iso = (b: Uint8Array): Shape => {
    let at = 0;
    let pixels = 0;

    while (at + 8 <= b.length) {
      const end = boxEnd(b, at);

      if (end < at + 8) {
        break;
      }

      if (big(b, at + 4, 4) === 0x6d_65_74_61) {
        pixels = largestItem(b, at + 8, Math.min(end, b.length));
      }

      if (end > b.length) {
        const kind = String.fromCodePoint(...b.subarray(at + 4, at + 8));

        return [pixels, !/^[a-z\d]{4}$/u.test(kind)];
      }

      at = end;
    }

    return [pixels, true];
  };

  const bmpPixels = (b: Uint8Array): number => {
    const height = little(b, 22, 4);

    return little(b, 18, 4) * (height < 2 ** 31 ? height : 2 ** 32 - height);
  };

  const webpPixels = (b: Uint8Array): number => {
    const tag = big(b, 12, 4);

    if (tag === 0x56_50_38_58) {
      return (little(b, 24, 3) + 1) * (little(b, 27, 3) + 1);
    }

    if (tag === 0x56_50_38_4c) {
      const bits = little(b, 21, 4);

      return ((bits % 16_384) + 1) * ((Math.floor(bits / 16_384) % 16_384) + 1);
    }

    return (little(b, 26, 2) % 16_384) * (little(b, 28, 2) % 16_384);
  };

  const pastBlocks = (b: Uint8Array, from: number): number => {
    let at = from;

    while (at < b.length && b[at] !== 0) {
      at += (b[at] ?? 0) + 1;
    }

    return at + 1;
  };

  const colourTable = (flags: number): number =>
    flags >= 128 ? 3 * 2 ** ((flags % 8) + 1) : 0;

  const gifPixels = (b: Uint8Array): number => {
    let most = little(b, 6, 2) * little(b, 8, 2);
    let at = 13 + colourTable(b[10] ?? 0);

    while (at < b.length) {
      if (b[at] === 0x2c) {
        most = Math.max(
          most,
          (little(b, at + 1, 2) + little(b, at + 5, 2)) *
            (little(b, at + 3, 2) + little(b, at + 7, 2))
        );

        at = pastBlocks(b, at + 11 + colourTable(b[at + 9] ?? 0));
      } else if (b[at] === 0x21) {
        at = pastBlocks(b, at + 2);
      } else {
        break;
      }
    }

    return most;
  };

  const tiffPixels = (b: Uint8Array): number => {
    const read = b[0] === 0x49 ? little : big;
    let most = 0;
    let before = 0;
    let at = read(b, 4, 4);
    let entries = 1_000_000;

    while (at > before && at + 2 <= b.length) {
      const count = read(b, at, 2);
      const sides = [0, 0];

      entries -= count + 1;

      if (entries < 0) {
        return Number.POSITIVE_INFINITY;
      }

      for (let i = 0; i < count; i += 1) {
        const entry = at + 2 + i * 12;
        const tag = read(b, entry, 2) - 256;

        if (tag === 0 || tag === 1) {
          sides[tag] = read(b, entry + 8, read(b, entry + 2, 2) === 3 ? 2 : 4);
        }
      }

      most = Math.max(most, (sides[0] ?? 0) * (sides[1] ?? 0));
      before = at;
      at = read(b, at + 2 + count * 12, 4);
    }

    return most;
  };

  const measure = (b: Uint8Array): Shape => {
    const start = big(b, 0, 2);

    if (start === 0x89_50) {
      return png(b);
    }

    if (start === 0xff_d8) {
      return jpeg(b);
    }

    if (big(b, 4, 4) === 0x66_74_79_70) {
      return iso(b);
    }

    if (start === 0x47_49) {
      return [gifPixels(b), true];
    }

    if (start === 0x49_49 || start === 0x4d_4d) {
      return [tiffPixels(b), true];
    }

    if (start === 0x42_4d) {
      return [bmpPixels(b), true];
    }

    return [start === 0x52_49 ? webpPixels(b) : 0, true];
  };

  const kept = new Map<number, ImageBitmap>();

  const keptOf = (id: number): ImageBitmap => {
    const bitmap = kept.get(id);

    if (!bitmap) {
      throw fail("decode", "the preview was released");
    }

    return bitmap;
  };

  return {
    async decode(blob, edge, keep, maxPixels = Number.POSITIVE_INFINITY) {
      const tooLarge = (): Error =>
        fail("too-large", `this image has over ${maxPixels} pixels`);
      const [pixels, whole] = measure(new Uint8Array(await blob.arrayBuffer()));

      if (pixels > maxPixels) {
        throw tooLarge();
      }

      if (!whole) {
        throw fail("decode", "the file is cut off");
      }

      const full = await decodeFull(blob);

      if (full.width * full.height > maxPixels) {
        full.close();
        throw tooLarge();
      }

      const scale = Math.min(1, edge / Math.max(full.width, full.height));
      const { width, height } = full;
      let preview = full;

      if (scale < 1) {
        try {
          preview = await createImageBitmap(full, {
            resizeHeight: Math.max(1, Math.round(height * scale)),
            resizeQuality: "medium",
            resizeWidth: Math.max(1, Math.round(width * scale)),
          });
        } finally {
          full.close();
        }
      }

      if (keep !== undefined) {
        kept.get(keep)?.close();

        try {
          kept.set(keep, await createImageBitmap(preview));
        } catch (error) {
          preview.close();
          throw error;
        }
      }

      return { height, preview, width };
    },
    async keep(id, bitmap) {
      kept.get(id)?.close();
      kept.set(id, await createImageBitmap(bitmap));
    },
    async motion(id, type) {
      const preview = keptOf(id);
      const canvas = canvasFor(preview.width, preview.height);

      try {
        contextOf(canvas, "srgb").drawImage(preview, 0, 0);

        return await encode(canvas, type, 0.92);
      } finally {
        free(canvas);
      }
    },
    async region(source, rect, width, height) {
      const full = source instanceof Blob ? await decodeFull(source) : source;
      const canvas = canvasFor(width, height);

      try {
        const context = contextOf(canvas, "srgb");

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        context.drawImage(
          full,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          width,
          height
        );

        return await createImageBitmap(canvas);
      } finally {
        free(canvas);

        if (full !== source) {
          full.close();
        }
      }
    },
    async release(id) {
      kept.get(id)?.close();
      kept.delete(id);
      await Promise.resolve();
    },
    async resample(id, rect, width, height) {
      return await createImageBitmap(
        keptOf(id),
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        { resizeHeight: height, resizeQuality: "medium", resizeWidth: width }
      );
    },
  };
};

export type { DecodeReply, Kernel, Region };
export { imageKernel };
