import * as Cropper from "@zriz/react/cropper";
import { IconButton } from "./icon-button";

export const example = (
  <Cropper.Rotate
    aria-label="Rotate left"
    render={<IconButton icon="rotate-left" />}
  />
);
