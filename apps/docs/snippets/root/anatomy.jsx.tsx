import * as Cropper from "@zriz/react/cropper";

declare const photo: Blob;
declare const src: string;

export const example = (
  <Cropper.Root src={photo}>
    <Cropper.Viewport style={{ height: 400 }}>
      <Cropper.Image />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area">
        <Cropper.Grid />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Straighten">
      <Cropper.DialTicks />
    </Cropper.Dial>
    <div className="toolbar">
      <Cropper.Rotate>Rotate</Cropper.Rotate>
      <Cropper.Flip>Flip</Cropper.Flip>
      <Cropper.Reset>Reset</Cropper.Reset>
    </div>
  </Cropper.Root>
);
