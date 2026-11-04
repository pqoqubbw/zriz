import type { Cropper } from "../cropper";
import { ZrizError } from "./error";
import type { ExportOptions, ExportResult, LoadedImage } from "./image";
import { imageOf } from "./image-store";
import { cropShapeOf } from "./shape";
import { TIMEOUT, aborted, withTimeout } from "./turn";

export const exportImage = async (
  cropper: Cropper,
  image: LoadedImage,
  options: ExportOptions = {}
): Promise<ExportResult> => {
  if (options.signal?.aborted === true) {
    throw aborted();
  }
  const render = await withTimeout(
    import("./render").catch((error: unknown) => {
      throw new ZrizError("decode", `zriz: ${String(error)}`);
    }),
    TIMEOUT * 2,
    options.signal
  );
  return await render.exportImage(cropper, image, options);
};

export const exportCrop = async (
  cropper: Cropper,
  options?: ExportOptions
): Promise<ExportResult> => {
  const image = imageOf(cropper);
  if (!image) {
    throw new ZrizError("no-image", "zriz: load a photo before exporting");
  }
  return await exportImage(cropper, image, {
    ...options,
    shape: options?.shape ?? cropShapeOf(cropper),
  });
};
