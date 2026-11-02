import * as Cropper from "@zriz/react/cropper";

export const example = (
  <Cropper.Grid
    className={(state) =>
      state.grid === "fine" ? "opacity-50" : undefined
    }
  />
);
