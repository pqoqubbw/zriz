"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useEffect, useRef, useState } from "react";

export const SaveCrop = ({ file }: { file: File }) => {
  const cropper = useRef<CropperApi>(null);
  const running = useRef<AbortController | null>(null);
  const [loaded, setLoaded] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => running.current?.abort(), [file]);

  const save = async () => {
    if (!cropper.current || running.current) return;
    const controller = new AbortController();

    running.current = controller;
    setSaving(true);
    const result = await exportCrop(cropper.current, {
      type: "image/webp",
      maxSize: { width: 2048, height: 2048 },
      signal: controller.signal,
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) console.error(error);

      return null;
    });

    running.current = null;
    setSaving(false);
    if (!result) return;
    const { blob, type } = result;
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    const extension = type === "image/webp" ? "webp" : "png";

    link.download = `crop.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  return (
    <>
      <Cropper.Root
        src={file}
        actionsRef={cropper}
        onLoad={() => setLoaded(file)}
      >
        <Cropper.Viewport style={{ width: 480, height: 360 }}>
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      <button
        type="button"
        disabled={loaded !== file}
        aria-disabled={saving}
        onClick={save}
      >
        save
      </button>
    </>
  );
};
