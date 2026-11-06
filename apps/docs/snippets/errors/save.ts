import type { Cropper } from "@zriz/core";
import { exportCrop, ZrizError } from "@zriz/core/dom";

export const save = async (
  cropper: Cropper,
  signal?: AbortSignal
) => {
  try {
    const { blob } = await exportCrop(cropper, { signal });

    return blob;
  } catch (error) {
    if (
      error instanceof ZrizError &&
      error.code === "aborted"
    ) {
      return null;
    }

    throw error;
  }
};
