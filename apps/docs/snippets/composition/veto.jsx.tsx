import * as Cropper from "@zriz/react/cropper";
import { preventZrizHandler } from "@zriz/react";

export const example = (
  <Cropper.Reset
    onClick={(event) => {
      if (!window.confirm("discard your changes?")) {
        preventZrizHandler(event);
      }
    }}
  >
    reset
  </Cropper.Reset>
);
