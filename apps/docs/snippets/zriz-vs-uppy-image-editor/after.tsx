"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

type Props = {
  file: File;
  onSave: (edited: File) => void;
  onCancel: () => void;
};

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

const types = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const ratios = [
  { label: "Free", value: "free" },
  { label: "Crop square", value: 1 },
  { label: "Crop landscape (16:9)", value: 16 / 9 },
  { label: "Crop portrait (9:16)", value: 9 / 16 },
] as const;

export const ImageEditor = ({
  file,
  onSave,
  onCancel,
}: Props) => {
  const actions = useRef<CropperApi>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    if (!actions.current || saving) return;

    setSaving(true);
    setFailed(false);

    try {
      const { blob, type } = await exportCrop(actions.current, {
        type: types.find((known) => known === file.type),
        quality: 0.8,
      });

      onSave(new File([blob], file.name, { type }));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Cropper.Root
      actionsRef={actions}
      src={file}
      onLoad={() => setReady(true)}
      onError={() => setFailed(true)}
    >
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        disabled={!ready}
        aria-disabled={saving}
        onClick={save}
      >
        Save
      </button>
      <Cropper.Viewport
        wheel="zoom"
        style={{ height: 440, padding: 24 }}
      >
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label={`Crop area of ${file.name}`}>
          <Cropper.Grid />
          {handles.map((position) => (
            <Cropper.Handle
              key={position}
              position={position}
            />
          ))}
        </Cropper.Area>
      </Cropper.Viewport>
      <Cropper.Reset>Reset</Cropper.Reset>
      <Cropper.Rotate>Rotate 90°</Cropper.Rotate>
      <Cropper.Dial aria-label="Straighten">
        <Cropper.DialTicks />
      </Cropper.Dial>
      <Cropper.Flip>Flip horizontally</Cropper.Flip>
      <Cropper.ZoomStep factor={1.1}>Zoom in</Cropper.ZoomStep>
      <Cropper.ZoomStep factor={1 / 1.1}>
        Zoom out
      </Cropper.ZoomStep>
      <Cropper.AspectGroup aria-label="Aspect ratio">
        {ratios.map((ratio) => (
          <Cropper.AspectItem
            key={ratio.label}
            value={ratio.value}
          >
            {ratio.label}
          </Cropper.AspectItem>
        ))}
      </Cropper.AspectGroup>
      {failed && (
        <p role="alert">This photo did not open or save.</p>
      )}
    </Cropper.Root>
  );
};
