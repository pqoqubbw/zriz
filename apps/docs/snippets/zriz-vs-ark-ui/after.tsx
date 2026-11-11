"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useRef, useState } from "react";

type Source = string | Blob;

type Props = {
  src: Source;
  onSave: (png: Blob) => void;
};

export const ImageCropper = ({ src, onSave }: Props) => {
  const cropper = useRef<CropperApi>(null);
  const running = useRef<AbortController | null>(null);
  const [loaded, setLoaded] = useState<Source | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => running.current?.abort(), [src]);

  const save = async () => {
    if (!cropper.current || running.current) return;
    const controller = new AbortController();

    running.current = controller;
    setSaving(true);

    try {
      const { blob } = await exportCrop(cropper.current, {
        type: "image/png",
        signal: controller.signal,
      });

      setFailed(false);
      onSave(blob);
    } catch {
      setFailed(!controller.signal.aborted);
    } finally {
      running.current = null;
      setSaving(false);
    }
  };

  return (
    <>
      <Cropper.Root
        src={src}
        actionsRef={cropper}
        maxZoom={5}
        onLoad={() => setLoaded(src)}
      >
        <Cropper.Viewport
          wheel="zoom"
          style={{ maxWidth: 480, height: 320, padding: 24 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area">
            <Cropper.Grid />
            <Cropper.Handle position="top-left" />
            <Cropper.Handle position="top" />
            <Cropper.Handle position="top-right" />
            <Cropper.Handle position="right" />
            <Cropper.Handle position="bottom-right" />
            <Cropper.Handle position="bottom" />
            <Cropper.Handle position="bottom-left" />
            <Cropper.Handle position="left" />
          </Cropper.Area>
        </Cropper.Viewport>
        <Cropper.Instructions>
          Arrow keys move the crop. Alt and the arrow keys
          resize it. Plus and minus zoom.
        </Cropper.Instructions>
      </Cropper.Root>
      {failed && <p role="alert">This crop did not save.</p>}
      <button
        type="button"
        disabled={loaded !== src}
        aria-disabled={saving}
        onClick={save}
      >
        Save
      </button>
    </>
  );
};
