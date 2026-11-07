import * as Cropper from "@zriz/react/cropper";

declare const photo: Blob;

export const example = (
  <Cropper.Root
    src={photo}
    defaultValue={{ perspective: { vertical: 0, horizontal: 0 } }}
  >
    <Cropper.Viewport style={{ height: 380 }}>
      <Cropper.Image />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area" />
    </Cropper.Viewport>
    <Cropper.Rotate aria-label="Rotate left" />
    <Cropper.DialValue />
    <Cropper.Dial aria-label="Straighten">
      <Cropper.DialTicks />
    </Cropper.Dial>
    <Cropper.Flip aria-label="Flip" />
  </Cropper.Root>
);
