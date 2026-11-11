import type { Cropper } from "../cropper";
import type { Size } from "../geometry/types";
import { ZrizError } from "./error";
import { toolsOf } from "./free";
import type { ExportOptions, ExportResult, LoadedImage } from "./image";
import { encoderQuality, jpegQuality } from "./jpeg-quality";
import { loadElement } from "./media";
import { renderKernel } from "./render-kernel";
import type { RenderJob, RenderKernel, RenderReply } from "./render-kernel";
import { TIMEOUT_MS, aborted, withTimeout } from "./turn";
import type { Lane, Turn } from "./worker";

const DEFAULT_QUALITY = 0.9;

let exportTurn: Turn | undefined;

let renderer: Lane<RenderKernel> | undefined;

const rendering = (): Lane<RenderKernel> => {
  renderer ??= toolsOf().lane(renderKernel);

  return renderer;
};

const renderOff = async (job: RenderJob): Promise<RenderReply> =>
  await toolsOf().via(rendering(), "render", [job]);

const renderHere = async (job: RenderJob): Promise<RenderReply> =>
  await rendering().here().render(job);

const qualityFor = async (
  image: LoadedImage,
  options: ExportOptions,
  type: string
): Promise<number> => {
  if (options.quality !== undefined) {
    return options.quality;
  }

  if (
    type === "image/png" ||
    image.mime !== "image/jpeg" ||
    !(image.source instanceof Blob)
  ) {
    return DEFAULT_QUALITY;
  }

  const source = await jpegQuality(image.source).catch(() => null);

  if (source === null) {
    return DEFAULT_QUALITY;
  }

  return Math.min(DEFAULT_QUALITY, await encoderQuality(source));
};

const firstScale = (
  base: Size,
  options: ExportOptions,
  type: string
): number => {
  const fit = options.maxSize
    ? Math.min(
        1,
        options.maxSize.width / base.width,
        options.maxSize.height / base.height
      )
    : 1;

  return Math.min(
    fit > 0 ? fit : 1,
    Math.sqrt(toolsOf().outputLimit() / (base.width * base.height)),
    (type === "image/webp" ? 16_383 : 65_500) /
      Math.max(base.width, base.height)
  );
};

const exportImage = async (
  cropper: Cropper,
  image: LoadedImage,
  options: ExportOptions = {}
): Promise<ExportResult> => {
  const state = cropper.getCropState();
  const base = cropper.getPixelCrop(1);

  if (!state || !base) {
    throw new ZrizError("no-image", "zriz: nothing to export yet");
  }

  const type =
    options.type ?? (options.shape === "circle" ? "image/png" : "image/jpeg");
  const first = firstScale(base, options, type);
  const quality = await qualityFor(image, options, type);
  const scales = [first, first / 2, first / 4];
  const crops = scales.map((scale) => cropper.getPixelCrop(scale) ?? base);
  const plans = crops.map((plan) => ({
    forward: plan.forward,
    height: plan.height,
    homography: plan.homography,
    width: plan.width,
  }));
  const url =
    options.colorSpace === "display-p3" && image.source instanceof Blob
      ? URL.createObjectURL(
          new Blob([image.source], { type: image.mime ?? "" })
        )
      : null;
  let over = false;

  const work = async (): Promise<RenderReply> => {
    if ("width" in image.source && image.source.width === 0) {
      throw aborted();
    }

    const element = url === null ? null : await loadElement(url);

    try {
      if (over) {
        throw aborted();
      }

      const source = element
        ? {
            drawable: element,
            height: element.naturalHeight,
            width: element.naturalWidth,
          }
        : image.source;
      const render = element ? renderHere : renderOff;

      return await render({
        circle: options.shape === "circle",
        colorSpace: options.colorSpace ?? "srgb",
        image: state.image,
        plans,
        quality,
        source,
        type,
      });
    } finally {
      element?.removeAttribute("src");
    }
  };

  try {
    exportTurn ??= toolsOf().gate(1);

    const { blob, index } = await withTimeout(
      exportTurn(
        async () => await withTimeout(work(), TIMEOUT_MS * 2, undefined),
        TIMEOUT_MS * 2,
        options.signal
      ),
      Number.POSITIVE_INFINITY,
      options.signal
    );
    const crop = crops[index] ?? base;

    return {
      blob,
      crop,
      height: crop.height,
      scaled: crop.width < base.width || crop.height < base.height,
      type: blob.type,
      width: crop.width,
    };
  } catch (error) {
    throw toolsOf().toZriz(error, image.mime);
  } finally {
    over = true;

    if (url !== null) {
      URL.revokeObjectURL(url);
    }
  }
};

export { exportImage };
