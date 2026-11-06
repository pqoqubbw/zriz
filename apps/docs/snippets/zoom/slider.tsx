"use client";

import { useZoom } from "@zriz/react";

export const ZoomSlider = () => {
  const zoom = useZoom();

  return (
    <input
      type="range"
      aria-label="Zoom"
      min={zoom.min}
      max={zoom.max}
      step={0.01}
      value={zoom.value}
      onChange={(e) =>
        zoom.onValueChange(e.target.valueAsNumber)
      }
      onPointerUp={zoom.onValueCommitted}
      onPointerCancel={zoom.onValueCommitted}
      onKeyUp={zoom.onValueCommitted}
    />
  );
};
