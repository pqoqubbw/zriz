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
        aria-disabled={zoom.value <= zoom.min || undefined}
      >
        −
      </Cropper.ZoomStep>
      <Cropper.ZoomStep
        factor={1.25}
        aria-label="Zoom in"
        aria-disabled={zoom.value >= zoom.max || undefined}
      >
        +
      </Cropper.ZoomStep>
    </>
  );
};
