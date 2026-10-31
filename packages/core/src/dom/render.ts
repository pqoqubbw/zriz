import type { Cropper } from "../cropper";
import { ZrizError } from "./error";
import { TIMEOUT, outputLimit, toZriz, withTimeout } from "./image";
import type { ExportOptions, ExportResult, LoadedImage } from "./image";
import { loadElement } from "./media";
import { renderKernel } from "./render-kernel";
import type { RenderJob, RenderKernel, RenderReply } from "./render-kernel";
import { lane, via } from "./worker";
import type { Lane } from "./worker";

const QUALITY = 0.9;

let renderer: Lane<RenderKernel> | undefined;

const rendering = (): Lane<RenderKernel> => {
  renderer ??= lane(renderKernel);
  return renderer;
};

const isRender = (value: unknown): value is RenderReply =>
  typeof value === "object" && value !== null && "blob" in value;

const renderOff = async (job: RenderJob): Promise<RenderReply> =>
  await via(
    rendering(),
    "render",
    [job],
    isRender,
    async (kernel) => await kernel.render(job)
  );

const renderHere = async (job: RenderJob): Promise<RenderReply> =>
  await rendering().here().render(job);

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
  const type =
    options.type ?? (options.shape === "circle" ? "image/png" : "image/jpeg");
  const fit = options.maxSize
    ? Math.min(
        1,
        options.maxSize.width / base.width,
        options.maxSize.height / base.height
      )
    : 1;
  const first = Math.min(
    fit,
    Math.sqrt(outputLimit() / (base.width * base.height))
  );
  const scales = [first, first / 2, first / 4];
  const crops = scales.map((scale) => cropper.getPixelCrop(scale) ?? base);
  const plans = crops.map((plan) => ({
    forward: plan.forward,
    height: plan.height,
    homography: plan.homography,
    width: plan.width,
  }));
  const wide =
    options.colorSpace === "display-p3" && image.source instanceof Blob;
  const url =
    wide && image.source instanceof Blob
      ? URL.createObjectURL(image.source)
      : null;
  try {
    const element = url === null ? null : await loadElement(url, undefined);
    const source = element
      ? {
          drawable: element,
          height: element.naturalHeight,
          width: element.naturalWidth,
        }
      : image.source;
    const render = element ? renderHere : renderOff;
    const { blob, index } = await withTimeout(
      render({
        circle: options.shape === "circle",
        colorSpace: options.colorSpace ?? "srgb",
        image: state.image,
        plans,
        quality: options.quality ?? QUALITY,
        source,
        type,
      }),
      TIMEOUT * 2,
      options.signal
    );
    const crop = crops[index] ?? base;
    return {
      blob,
      crop,
      height: crop.height,
      scaled: (scales[index] ?? first) < 1,
      type: blob.type,
      width: crop.width,
    };
  } catch (error) {
    throw toZriz(error, image.mime);
  } finally {
    if (url !== null) {
      URL.revokeObjectURL(url);
    }
  }
};

export const renderActive = (): boolean => renderer?.active() ?? false;
