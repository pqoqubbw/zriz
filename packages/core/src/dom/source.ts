import { ZrizError } from "./error";
import { canvasFor, context2d, drawn, free } from "./media";

const assertReadable = (source: CanvasImageSource): void => {
  const canvas = canvasFor({ height: 1, width: 1 });
  const context = context2d(canvas);
  context.drawImage(source, 0, 0, 1, 1);
  try {
    context.getImageData(0, 0, 1, 1);
  } catch {
    throw new ZrizError(
      "cross-origin",
      "zriz: the image is cross-origin without CORS. Serve it with Access-Control-Allow-Origin and set crossOrigin."
    );
  } finally {
    free(canvas);
  }
};

export const fromElement = async (
  src: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas
): Promise<ImageBitmap> => {
  if (
    typeof HTMLVideoElement !== "undefined" &&
    src instanceof HTMLVideoElement
  ) {
    assertReadable(src);
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
    return await createImageBitmap(src);
  }
  assertReadable(src);
  return await createImageBitmap(src);
};
