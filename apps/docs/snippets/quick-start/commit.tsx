import * as Cropper from "@zriz/react/cropper";

declare const photo: Blob;

export const example = (
  <Cropper.Root
    src={photo}
    onError={(error) => console.error(error.code)}
    onValueCommit={(value, details) => {
      console.log(value, details.pixelCrop);
    }}
  >
    <Cropper.Viewport />
  </Cropper.Root>
);
