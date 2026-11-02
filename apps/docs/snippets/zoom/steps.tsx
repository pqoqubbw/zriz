"use client";

import { useZoom } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";

export const ZoomSteps = () => {
  const zoom = useZoom();
  return (
    <>
      <Cropper.ZoomStep
        factor={0.8}
        aria-label="Zoom out"
        disabled={zoom.value <= zoom.min}
      >
        −
      </Cropper.ZoomStep>
      <Cropper.ZoomStep
        factor={1.25}
        aria-label="Zoom in"
        disabled={zoom.value >= zoom.max}
      >
        +
      </Cropper.ZoomStep>
    </>
  );
};
