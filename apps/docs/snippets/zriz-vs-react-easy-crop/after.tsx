"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

type Props = {
  src: string | File;
  onSave: (jpeg: Blob) => void;
};

export const PhotoCropper = ({ src, onSave }: Props) => {
  const cropper = useRef<CropperApi>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    if (!cropper.current) return;

    try {
      const { blob } = await exportCrop(cropper.current, {
        type: "image/jpeg",
        maxSize: { width: 1600, height: 1200 },
      });

      setFailed(false);
      onSave(blob);
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <Cropper.Root
        actionsRef={cropper}
        src={src}
        aspect={4 / 3}
        maxZoom={3}
        onLoad={() => setReady(true)}
        onError={() => setReady(false)}
      >
        <Cropper.Viewport
          wheel="zoom"
          rotateGesture={false}
          style={{ maxWidth: 480, height: 360 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
        <Cropper.Zoom
          aria-label="Zoom"
          style={{ width: 240, height: 24 }}
        >
          <Cropper.ZoomThumb />
        </Cropper.Zoom>
      </Cropper.Root>
      {failed && <p role="alert">This crop did not save.</p>}
      <button type="button" disabled={!ready} onClick={save}>
        Save
      </button>
    </>
  );
};
