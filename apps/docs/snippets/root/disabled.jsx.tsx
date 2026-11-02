import * as Cropper from "@zriz/react/cropper";

declare const photo: Blob;
declare const saving: boolean;
declare const src: string;

export const example = (
  <Cropper.Root src={photo} disabled={saving}>
    <Cropper.Viewport style={{ height: 400 }}>
      <Cropper.Image />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area" />
    </Cropper.Viewport>
  </Cropper.Root>
);
