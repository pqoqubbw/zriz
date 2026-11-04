import type { Cropper } from "../cropper";
import type { Size } from "../geometry/types";
import { ZrizError } from "./error";
import { outputLimit, toZriz } from "./image";
import type { ExportOptions, ExportResult, LoadedImage } from "./image";
import { loadElement } from "./media";
import { renderKernel } from "./render-kernel";
import type { RenderJob, RenderKernel, RenderReply } from "./render-kernel";
import { TIMEOUT, aborted, withTimeout } from "./turn";
import { gate, lane, via } from "./worker";
import type { Lane } from "./worker";

const QUALITY = 0.9;

const exportTurn = gate(1);

let renderer: Lane<RenderKernel> | undefined;

const rendering = (): Lane<RenderKernel> => {
  renderer ??= lane(renderKernel);
  return renderer;
};

const renderOff = async (job: RenderJob): Promise<RenderReply> =>
  await via(rendering(), "render", [job]);

const renderHere = async (job: RenderJob): Promise<RenderReply> =>
  await rendering().here().render(job);

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
    Math.sqrt(outputLimit() / (base.width * base.height)),
    (type === "image/webp" ? 16_383 : 65_500) /
      Math.max(base.width, base.height)
  );
};

export const exportImage = async (
  cropper: Cropper,
  image: LoadedImage,
  options: ExportOptions = {}
): Promise<ExportResult> => {
  const state = cropper.getCropState();
  const base = cropper.getPixelCrop(1);
  if (!state || !base) {
    throw new ZrizError("no-image", "zriz: nothing to export yet");
  }
  if (
    state.image.width !== image.width ||
    state.image.height !== image.height
  ) {
    throw aborted();
  }
  const type =
    options.type ?? (options.shape === "circle" ? "image/png" : "image/jpeg");
  const first = firstScale(base, options, type);
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
        quality: options.quality ?? QUALITY,
        source,
        type,
      });
    } finally {
      element?.removeAttribute("src");
    }
  };
  try {
    const { blob, index } = await withTimeout(
      exportTurn(
        async () => await withTimeout(work(), TIMEOUT * 2, undefined),
        TIMEOUT * 2,
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
    throw toZriz(error, image.mime);
  } finally {
    over = true;
    if (url !== null) {
      URL.revokeObjectURL(url);
    }
  }
};
