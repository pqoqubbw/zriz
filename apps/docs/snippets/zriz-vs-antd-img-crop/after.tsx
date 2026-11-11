"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useRef, useState } from "react";

type Props = {
  file: File;
  onCancel: () => void;
  onCrop: (cropped: File) => void;
};

const TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const unreadable = "This photo does not open. Pick another.";
const unsaved = "This crop did not save. Try again.";

export const CropDialog = ({
  file,
  onCancel,
  onCrop,
}: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const actions = useRef<CropperApi>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const node = dialog.current;

    node?.showModal();

    return () => node?.close();
  }, []);

  const save = async () => {
    if (!actions.current || saving) return;
    const type =
      TYPES.find((item) => item === file.type) ?? "image/jpeg";

    setSaving(true);

    try {
      const result = await exportCrop(actions.current, {
        type,
      });

      onCrop(
        new File([result.blob], file.name, {
          type: result.type,
        })
      );
    } catch {
      setProblem(unsaved);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Edit image"
      onCancel={onCancel}
    >
      <Cropper.Root
        actionsRef={actions}
        src={file}
        aspect={1}
        maxZoom={3}
        onLoad={() => setReady(true)}
        onError={() => setProblem(unreadable)}
      >
        <Cropper.Viewport
          wheel="zoom"
          rotateGesture={false}
          style={{ width: 480, height: 320 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
        <Cropper.ZoomStep factor={0.8} aria-label="Zoom out">
          −
        </Cropper.ZoomStep>
        <Cropper.Zoom
          aria-label="Zoom"
          style={{ width: 240, height: 24 }}
        >
          <Cropper.ZoomThumb />
        </Cropper.Zoom>
        <Cropper.ZoomStep factor={1.25} aria-label="Zoom in">
          +
        </Cropper.ZoomStep>
      </Cropper.Root>
      {problem && <p role="alert">{problem}</p>}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        disabled={!ready}
        aria-disabled={saving}
        onClick={save}
      >
        OK
      </button>
    </dialog>
  );
};
