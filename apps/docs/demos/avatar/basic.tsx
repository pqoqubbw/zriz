"use client";

import type { CommitDetails } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useState } from "react";

const Avatar = () => {
  const [crop, setCrop] = useState<CommitDetails["pixelCrop"]>(null);
  return (
    <div className="avatar-demo">
      <Cropper.Root
        aspect={1}
        onValueCommit={(_, details) => {
          setCrop(details.pixelCrop);
        }}
        shape="circle"
        src="/sunset.jpg"
      >
        <Cropper.Viewport className="avatar-viewport">
          <Cropper.Image alt="" />
          <Cropper.Mask />
          <Cropper.Area aria-label="Avatar crop" />
        </Cropper.Viewport>
      </Cropper.Root>
      <output>
        {crop?.pixelRect
          ? `${crop.pixelRect.width} × ${crop.pixelRect.height} px at ${crop.pixelRect.left}, ${crop.pixelRect.top}`
          : "Drag, pinch or scroll the photo"}
      </output>
    </div>
  );
};

export default Avatar;
