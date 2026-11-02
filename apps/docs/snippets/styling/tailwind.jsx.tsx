import * as Cropper from "@zriz/react/cropper";

declare const file: Blob | null;
declare const src: string;

export const example = (
  <Cropper.Root src={file}>
    <Cropper.Viewport className="h-80 overflow-clip">
      <Cropper.Image />
      <Cropper.Mask className="bg-black/60" />
      <Cropper.Area
        aria-label="Crop area"
        className="ring-1 ring-white data-interacting:ring-2"
      />
    </Cropper.Viewport>
  </Cropper.Root>
);
