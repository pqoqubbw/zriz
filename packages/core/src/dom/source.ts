import { ZrizError } from "./error";
import { canvasFor, context2d, drawn, free } from "./media";

export const assertReadable = (source: CanvasImageSource): number => {
  const canvas = canvasFor({ height: 1, width: 1 });
  try {
    const context = context2d(canvas);
    context.drawImage(source, 0, 0, 1, 1);
    try {
      return context.getImageData(0, 0, 1, 1).data[3] ?? 0;
    } catch {
      throw new ZrizError(
        "cross-origin",
        "zriz: the image is cross-origin without CORS. Serve it with Access-Control-Allow-Origin and set crossOrigin."
      );
    }
  } finally {
    free(canvas);
  }
};

export const fromElement = async (
  src:
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | OffscreenCanvas
    | ImageBitmap
): Promise<ImageBitmap> => {
  if (
    typeof HTMLVideoElement !== "undefined" &&
    src instanceof HTMLVideoElement
  ) {
    if (src.readyState < 2 || src.seeking || assertReadable(src) === 0) {
      throw new ZrizError(
        "decode",
        "zriz: the video has no current frame yet. Wait for loadeddata or seeked."
      );
    }
    return await drawn(src, {
      height: src.videoHeight,
      width: src.videoWidth,
    });
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    src instanceof HTMLImageElement
  ) {
    if (!src.complete || src.naturalWidth === 0) {
      await src.decode();
    }
    assertReadable(src);
    return await drawn(src, {
      height: src.naturalHeight,
      width: src.naturalWidth,
    });
  }
  assertReadable(src);
  return src instanceof ImageBitmap ? src : await createImageBitmap(src);
};
