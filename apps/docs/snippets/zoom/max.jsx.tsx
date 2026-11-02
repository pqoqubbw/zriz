import * as Cropper from "@zriz/react/cropper";

export const example = (
  <Cropper.Zoom
    max={5}
    aria-label="Zoom"
    style={{ width: 240, height: 24 }}
  >
    <Cropper.ZoomThumb max={5} />
  </Cropper.Zoom>
);
