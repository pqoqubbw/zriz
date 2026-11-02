import * as Cropper from "@zriz/react/cropper";
import type { CropValue } from "@zriz/react";

declare const src: string;
declare const setAngle: (angle: number) => void;
declare const save: (value: CropValue) => void;

export const example = (
  <Cropper.Root
    src={src}
    onValueChange={(value) => setAngle(value.rotation)}
    onValueCommit={(value) => save(value)}
  />
);
