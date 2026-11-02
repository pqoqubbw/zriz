import * as Cropper from "@zriz/react/cropper";

export const example = (
  <Cropper.Area aria-label="Crop area">
    <Cropper.Grid />
    <Cropper.Handle position="top-left" />
    <Cropper.Handle position="top" />
    <Cropper.Handle position="top-right" />
    <Cropper.Handle position="right" />
    <Cropper.Handle position="bottom-right" />
    <Cropper.Handle position="bottom" />
    <Cropper.Handle position="bottom-left" />
    <Cropper.Handle position="left" />
  </Cropper.Area>
);
