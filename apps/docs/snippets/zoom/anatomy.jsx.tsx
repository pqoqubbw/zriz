import * as Cropper from "@zriz/react/cropper";

export const example = (
  <>
    <Cropper.ZoomStep factor={0.8} aria-label="Zoom out">
      −
    </Cropper.ZoomStep>
    <Cropper.Zoom
      aria-label="Zoom"
      style={{ width: 240, height: 24 }}
    >
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
    <Cropper.ZoomStep factor={1.25} aria-label="Zoom in">
      +
    </Cropper.ZoomStep>
  </>
);
