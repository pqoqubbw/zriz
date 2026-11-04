import type { Size } from "../geometry/types";
import { ZrizError } from "./error";

export const fitEdge = (size: Size, edge: number): Size => {
  const scale = Math.min(1, edge / Math.max(size.width, size.height));

  return {
    height: Math.max(1, Math.round(size.height * scale)),
    width: Math.max(1, Math.round(size.width * scale)),
  };
};

export const canvasFor = (size: Size): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(size.width, size.height);
  }

  const canvas = document.createElement("canvas");

  canvas.width = size.width;
  canvas.height = size.height;

  return canvas;
};

export const context2d = (
  canvas: {
    getContext: (
      id: "2d",
      settings: CanvasRenderingContext2DSettings
    ) => OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  },
  colorSpace: PredefinedColorSpace = "srgb"
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D => {
  const context = canvas.getContext("2d", { colorSpace });

  if (!context) {
    throw new ZrizError("decode", "zriz: no 2D canvas");
  }

  return context;
};

export const free = (canvas: OffscreenCanvas | HTMLCanvasElement): void => {
  canvas.width = 0;
  canvas.height = 0;
};

export const drawn = async (
  source: CanvasImageSource,
  size: Size
): Promise<ImageBitmap> => {
  const canvas = canvasFor(size);

  try {
    context2d(canvas).drawImage(source, 0, 0, size.width, size.height);

    return await createImageBitmap(canvas);
  } finally {
    free(canvas);
  }
};

export const loadElement = async (url: string): Promise<HTMLImageElement> => {
  const image = new Image();

  image.decoding = "async";
  image.src = url;

  try {
    await image.decode();
  } catch {
    throw new ZrizError(
      "decode",
      `zriz: could not load the image. It may be damaged, or img-src may block ${url.split(":", 1)[0]}: urls.`
    );
  }

  return image;
};

export const textOf = (bytes: Uint8Array): string => {
  const [first, second] = bytes;
  let encoding = "utf-8";

  if (first === 0xff && second === 0xfe) {
    encoding = "utf-16le";
  }

  if (first === 0xfe && second === 0xff) {
    encoding = "utf-16be";
  }

  return new TextDecoder(encoding).decode(bytes);
};
