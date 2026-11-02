import * as Cropper from "@zriz/react/cropper";
import type { CropValue } from "@zriz/react";
import type { ExportPlan } from "@zriz/core";

declare const src: string;
declare const upload: (
  value: CropValue,
  pixelCrop: ExportPlan | null
) => void;

export const example = (
  <Cropper.Root
    src={src}
    onValueCommit={(value, details) => {
      upload(value, details.pixelCrop);
    }}
  />
);
