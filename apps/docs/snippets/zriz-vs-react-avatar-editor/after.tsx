"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

type Props = {
  image: string | File;
  onSave: (file: Blob) => void;
};

const track = {
  width: 200,
  height: 24,
  backgroundImage:
    "linear-gradient(currentColor, currentColor)",
  backgroundSize: "100% 2px",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

const thumb = {
  top: 4,
  width: 16,
  height: 16,
  borderRadius: 8,
  background: "currentColor",
  translate: "-50%",
};

export const AvatarCropper = ({ image, onSave }: Props) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const actions = useRef<CropperApi>(null);

  const save = async () => {
    if (!actions.current) return;

    try {
      const { blob } = await exportCrop(actions.current, {
        maxSize: { width: 500, height: 500 },
      });

      setFailed(false);
      onSave(blob);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Cropper.Root
      actionsRef={actions}
      src={image}
      aspect={1}
      maxZoom={5}
      onLoad={() => setReady(true)}
      onError={() => setReady(false)}
    >
      <Cropper.Viewport
        wheel="zoom"
        style={{
          boxSizing: "border-box",
          width: 350,
          height: 350,
          padding: 50,
        }}
      >
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
      <Cropper.Zoom aria-label="Zoom" max={5} style={track}>
        <Cropper.ZoomThumb max={5} style={thumb} />
      </Cropper.Zoom>
      {failed && <p role="alert">This crop did not save.</p>}
      <button type="button" disabled={!ready} onClick={save}>
        Save
      </button>
    </Cropper.Root>
  );
};
