import { attachImage, loadImage } from "@zriz/core/dom";
import type { Cropper } from "@zriz/react";

const convert = async (blob: Blob) => {
  const response = await fetch("/api/convert", {
    method: "POST",
    body: blob,
  });
  return await createImageBitmap(await response.blob());
};

export const open = async (
  cropper: Cropper,
  file: File,
  signal: AbortSignal
) => {
  const image = await loadImage(file, {
    timeout: 30_000,
    decode: convert,
    signal,
  });
  attachImage(cropper, image);
};
