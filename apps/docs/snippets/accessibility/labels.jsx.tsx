import * as Cropper from "@zriz/react/cropper";

export const example = (
  <>
    <Cropper.Area aria-label="Crop area" />
    <Cropper.Dial aria-label="Straighten" />
    <Cropper.Zoom aria-label="Zoom" />
    <Cropper.AspectGroup aria-label="Aspect ratio">
      <Cropper.AspectItem value={1}>square</Cropper.AspectItem>
    </Cropper.AspectGroup>
    <Cropper.Rotate aria-label="Rotate left">
      rotate
    </Cropper.Rotate>
  </>
);
