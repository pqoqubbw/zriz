"use client";

import { useCropperState } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";

const RATIOS = [
  [4, 5],
  [3, 4],
  [9, 16],
] as const;

export const Ratios = () => {
  const aspect = useCropperState((s) => s.aspect);
  const wide = typeof aspect === "number" && aspect > 1;

  return (
    <Cropper.AspectGroup aria-label="Aspect ratio">
      <Cropper.AspectItem value="free">free</Cropper.AspectItem>
      <Cropper.AspectItem value={1}>1:1</Cropper.AspectItem>
      {RATIOS.map(([w, h]) => (
        <Cropper.AspectItem
          key={`${w}:${h}`}
          value={wide ? h / w : w / h}
        >
          {wide ? `${h}:${w}` : `${w}:${h}`}
        </Cropper.AspectItem>
      ))}
    </Cropper.AspectGroup>
  );
};
