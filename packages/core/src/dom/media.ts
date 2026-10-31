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
  context2d(canvas).drawImage(source, 0, 0, size.width, size.height);
  try {
    return await createImageBitmap(canvas);
  } finally {
    free(canvas);
  }
};

export const loadElement = async (
  url: string,
  crossOrigin: "anonymous" | "use-credentials" | undefined
): Promise<HTMLImageElement> => {
  const image = new Image();
  if (crossOrigin) {
    image.crossOrigin = crossOrigin;
  }
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new ZrizError("decode", `zriz: could not load ${url.slice(0, 80)}`);
  }
  return image;
};
