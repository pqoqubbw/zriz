"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

type Props = { src: string; onSave: (file: Blob) => void };
type Size = { width: number; height: number };

const START_RATIO = 16 / 9;
const START_AREA = 0.8;

const startSize = ({ width, height }: Size): Size => {
  const ratio = width / height;

  return ratio > START_RATIO
    ? {
        width: (START_AREA * START_RATIO) / ratio,
        height: START_AREA,
      }
    : {
        width: START_AREA,
        height: (START_AREA * ratio) / START_RATIO,
      };
};

export const PhotoCropper = ({ src, onSave }: Props) => {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const actions = useRef<CropperApi>(null);

  const save = async () => {
    if (!actions.current || saving) return;

    setSaving(true);

    try {
      const { blob } = await exportCrop(actions.current, {
        type: "image/png",
      });

      setFailed(false);
      onSave(blob);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Cropper.Root
        actionsRef={actions}
        src={src}
        onLoad={(image) => {
          actions.current?.setValue({ size: startSize(image) });
          setReady(true);
        }}
        onError={() => setReady(false)}
      >
        <Cropper.Viewport
          style={{ width: "100%", height: 400, padding: 24 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area">
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
      </Cropper.Root>
      {failed && <p role="alert">This crop did not save.</p>}
      <button
        type="button"
        disabled={!ready}
        aria-disabled={saving}
        onClick={save}
      >
        Crop image
      </button>
    </>
  );
};
