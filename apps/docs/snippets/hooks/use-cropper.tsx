"use client";

import { attachImage } from "@zriz/core/dom";
import { useCropper } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useEffect } from "react";

export const Editor = ({ src }: { src: string }) => {
  const cropper = useCropper({ maxZoom: 8 });

  useEffect(() => () => attachImage(cropper, null), [cropper]);

  return (
    <>
      <button onClick={() => cropper.reset()}>reset</button>
      <Cropper.Root cropper={cropper} src={src}>
        <Cropper.Viewport
          style={{ maxWidth: 480, height: 360 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
    </>
  );
};
