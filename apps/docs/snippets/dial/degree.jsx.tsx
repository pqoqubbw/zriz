import * as Cropper from "@zriz/react/cropper";

export const example = (
  <Cropper.DialValue
    format={(angle) =>
      `${Math.sign(angle) * Math.round(Math.abs(angle))}°`
    }
  />
);
