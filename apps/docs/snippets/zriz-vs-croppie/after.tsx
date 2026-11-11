"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

type Source = string | Blob;
type Props = { src: Source; onSave: (png: Blob) => void };

const frame = { width: 200, height: 200 };
const unsaved = "This crop did not save. Try again.";

export const PhotoCropper = ({ src, onSave }: Props) => {
  const cropper = useRef<CropperApi>(null);
  const running = useRef(false);
  const [loaded, setLoaded] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    if (!cropper.current || running.current) return;

    running.current = true;

    try {
      const { blob } = await exportCrop(cropper.current, {
        type: "image/png",
        maxSize: frame,
      });

      setFailed(false);
      onSave(blob);
    } catch {
      setFailed(true);
    } finally {
      running.current = false;
    }
  };

  return (
    <>
      <Cropper.Root
        src={src}
        aspect={1}
        actionsRef={cropper}
        onLoad={() => setLoaded(src)}
      >
        <Cropper.Viewport
          wheel="zoom"
          style={{
            boxSizing: "border-box",
            width: 300,
            height: 300,
            padding: 50,
          }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
        <Cropper.Zoom
          aria-label="Zoom"
          style={{ width: 300, height: 24 }}
        >
          <Cropper.ZoomThumb />
        </Cropper.Zoom>
      </Cropper.Root>
      {failed && <p role="alert">{unsaved}</p>}
      <button
        type="button"
        disabled={loaded !== src}
        onClick={save}
      >
        Save
      </button>
    </>
  );
};
