"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useEffect, useRef, useState } from "react";

export const CropWithPreview = ({ file }: { file: File }) => {
  const cropper = useRef<CropperApi>(null);
  const last = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => last.current?.abort(), []);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const refresh = async () => {
    if (!cropper.current) return;
    last.current?.abort();
    const controller = new AbortController();

    last.current = controller;

    try {
      const { blob } = await exportCrop(cropper.current, {
        maxSize: { width: 256, height: 256 },
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setPreview(URL.createObjectURL(blob));
      }
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    }
  };

  return (
    <>
      <Cropper.Root
        src={file}
        actionsRef={cropper}
        onLoad={() => void refresh()}
        onValueCommit={() => void refresh()}
      >
        <Cropper.Viewport style={{ width: 480, height: 360 }}>
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      {preview && <img src={preview} alt="Crop preview" />}
    </>
  );
};
