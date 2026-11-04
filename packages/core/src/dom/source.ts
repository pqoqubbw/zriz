import { ZrizError } from "./error";
import { canvasFor, context2d, drawn, free } from "./media";

const PROBE = 16;
const FRAME_TRIES = 180;
const FRAME_POLL_MS = 16;
const UNSIZED_WIDTH = 300;
const UNSIZED_HEIGHT = 150;

const assertReadable = (source: CanvasImageSource): boolean => {
  const canvas = canvasFor({ height: PROBE, width: PROBE });

  try {
    const context = context2d(canvas);

    context.drawImage(source, 0, 0, PROBE, PROBE);

    try {
      return context.getImageData(0, 0, PROBE, PROBE).data.some(Boolean);
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

const showsFrame = async (
  video: HTMLVideoElement,
  tries = FRAME_TRIES
): Promise<boolean> => {
  if (video.readyState < 2 || video.seeking) {
    return false;
  }

  if (assertReadable(video)) {
    return true;
  }

  if (tries === 0) {
    return false;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, FRAME_POLL_MS);
  });

  return await showsFrame(video, tries - 1);
};

const fromElement = async (
  src:
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | OffscreenCanvas
    | ImageBitmap,
  areaLimit: number
): Promise<ImageBitmap> => {
  if ("videoWidth" in src) {
    if (!(await showsFrame(src))) {
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

  if ("naturalWidth" in src) {
    if (!src.complete || src.naturalWidth === 0) {
      await src.decode();
    }

    assertReadable(src);
    const { naturalHeight: height, naturalWidth: width } = src;

    if (width * height > areaLimit) {
      return await createImageBitmap(src);
    }

    const bitmap = await createImageBitmap(src).catch(() => null);

    if (
      bitmap &&
      (bitmap.width !== UNSIZED_WIDTH ||
        bitmap.height !== UNSIZED_HEIGHT ||
        width * UNSIZED_HEIGHT === height * UNSIZED_WIDTH)
    ) {
      return bitmap;
    }

    bitmap?.close();

    return await drawn(src, { height, width });
  }

  assertReadable(src);

  return src instanceof ImageBitmap ? src : await createImageBitmap(src);
};

export { assertReadable, fromElement };
