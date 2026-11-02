"use client";

import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";

const photo = "https://picsum.photos/id/1015/1600/1200";

export const PhotoCropper = () => {
  return (
    <Cropper.Root src={photo}>
      <Cropper.Viewport
        style={{ width: 400, height: 300, padding: 24 }}
      >
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area">
          <Cropper.Handle position="top-left" />
          <Cropper.Handle position="top-right" />
          <Cropper.Handle position="bottom-right" />
          <Cropper.Handle position="bottom-left" />
        </Cropper.Area>
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
