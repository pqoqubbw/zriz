import * as Cropper from "@zriz/react/cropper";
import type { CropValue } from "@zriz/react";

declare const photo: Blob;
declare const src: string;
declare const save: (value: CropValue) => void;

export const example = (
  <Cropper.Root src={photo} onValueCommit={save}>
    <Cropper.Viewport style={{ maxWidth: 400, height: 300 }}>
      <Cropper.Image />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area" />
    </Cropper.Viewport>
    <Cropper.DialValue />
    <Cropper.Dial aria-label="Straighten">
      <Cropper.DialTicks />
    </Cropper.Dial>
  </Cropper.Root>
);
