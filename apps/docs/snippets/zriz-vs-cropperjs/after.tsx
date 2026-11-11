"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useRef, useState } from "react";

type Props = { src: string; onSave: (file: Blob) => void };

const handles = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
] as const;

const half = { size: { width: 0.5, height: 0.5 } };

export const PhotoCropper = ({ src, onSave }: Props) => {
  const actions = useRef<CropperApi>(null);
  const running = useRef<AbortController | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => running.current?.abort(), [src]);

  const save = async () => {
    if (!actions.current || running.current) return;
    const controller = new AbortController();

    running.current = controller;
    setSaving(true);
    setFailed(false);

    try {
      const { blob } = await exportCrop(actions.current, {
        type: "image/jpeg",
        quality: 0.9,
        maxSize: { width: 2048, height: 2048 },
        signal: controller.signal,
      });

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
        key={src}
        actionsRef={actions}
        src={src}
        defaultValue={half}
        onLoad={() => setLoaded(src)}
        onError={() => setFailed(true)}
      >
        <Cropper.Viewport
          wheel="zoom"
          style={{ maxWidth: 480, height: 360, padding: 24 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area">
            <Cropper.Grid />
            {handles.map((position) => (
              <Cropper.Handle
                key={position}
                position={position}
              />
            ))}
          </Cropper.Area>
        </Cropper.Viewport>
      </Cropper.Root>
      {failed && <p role="alert">That failed. Try again.</p>}
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
