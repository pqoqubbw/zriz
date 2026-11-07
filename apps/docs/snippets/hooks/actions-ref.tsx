"use client";

import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useRef } from "react";

export const Editor = ({ src }: { src: string }) => {
  const cropper = useRef<CropperApi>(null);

  const save = () => {
    console.log(cropper.current?.getPixelCrop());
  };

  return (
    <>
      <Cropper.Root src={src} actionsRef={cropper}>
        <Cropper.Viewport
          style={{ maxWidth: 480, height: 360 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      <button onClick={save}>Save</button>
    </>
  );
};
