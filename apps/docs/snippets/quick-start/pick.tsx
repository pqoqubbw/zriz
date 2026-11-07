"use client";

import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useState } from "react";

export const PhotoCropper = () => {
  const [photo, setPhoto] = useState<File | null>(null);

  return (
    <>
      <input
        aria-label="Choose a photo"
        type="file"
        accept="image/*"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
      />
      <Cropper.Root
        src={photo}
        onError={(error) => console.error(error.code)}
      >
        <Cropper.Viewport
          style={{ maxWidth: 400, height: 300, padding: 24 }}
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
          style={{ maxWidth: 361 }}
        >
          <Cropper.DialTicks />
        </Cropper.Dial>
      </Cropper.Root>
    </>
  );
};
