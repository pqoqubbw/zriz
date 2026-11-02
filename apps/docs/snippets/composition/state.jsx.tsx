import * as Cropper from "@zriz/react/cropper";
import { IconButton } from "./icon-button";

export const example = (
  <Cropper.Flip
    aria-label="Flip"
    render={(props, state) => (
      <IconButton
        {...props}
        icon={state.mirrored ? "flip-on" : "flip"}
      />
    )}
  />
);
