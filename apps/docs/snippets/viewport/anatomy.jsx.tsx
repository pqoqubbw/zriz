import * as Cropper from "@zriz/react/cropper";

export const example = (
  <Cropper.Viewport style={{ height: 400 }}>
    <Cropper.Image />
    <Cropper.Mask />
    <Cropper.Area aria-label="Crop area" />
  </Cropper.Viewport>
);
