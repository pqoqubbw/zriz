export interface DecodeReply {
  width: number;
  height: number;
  preview: ImageBitmap;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Kernel {
  decode: (blob: Blob, edge: number, keep?: number) => Promise<DecodeReply>;
  keep: (id: number, bitmap: ImageBitmap) => Promise<undefined>;
  motion: (id: number, type: string) => Promise<Blob>;
  resample: (id: number, scale: number) => Promise<ImageBitmap>;
  region: (
    source: Blob | ImageBitmap,
    rect: Region,
    width: number,
    height: number
  ) => Promise<ImageBitmap>;
  release: (id: number) => Promise<undefined>;
}

export const imageKernel = (): Kernel => {
  type Canvas = OffscreenCanvas | HTMLCanvasElement;
  type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

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
      throw fail("decode", "this browser cannot decode the file");
    }
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
    async decode(blob, edge, keep) {
      const full = await decodeFull(blob);
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
        kept.set(keep, await createImageBitmap(preview));
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
    async resample(id, scale) {
      const preview = keptOf(id);
      return await createImageBitmap(preview, {
        resizeHeight: Math.max(1, Math.round(preview.height * scale)),
        resizeQuality: "medium",
        resizeWidth: Math.max(1, Math.round(preview.width * scale)),
      });
    },
  };
};
