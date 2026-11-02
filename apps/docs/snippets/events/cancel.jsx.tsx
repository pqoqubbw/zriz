import * as Cropper from "@zriz/react/cropper";

declare const src: string;

export const example = (
  <Cropper.Root
    src={src}
    onValueChange={(value, details) => {
      if (Math.abs(value.rotation) > 10) details.cancel();
    }}
  />
);
