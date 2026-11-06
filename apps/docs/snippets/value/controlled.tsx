"use client";

import * as Cropper from "@zriz/react/cropper";
import { useState } from "react";

export const Editor = ({ src }: { src: string }) => {
  const [rotation, setRotation] = useState(0);

  return (
    <Cropper.Root
      src={src}
      rotation={rotation}
      onValueChange={(value) => setRotation(value.rotation)}
    >
      <Cropper.Viewport style={{ width: 480, height: 360 }}>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
      <Cropper.Dial
        aria-label="Straighten"
        style={{ width: 361 }}
      >
        <Cropper.DialTicks />
      </Cropper.Dial>
    </Cropper.Root>
  );
};
