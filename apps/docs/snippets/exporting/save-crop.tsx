"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useRef, useState } from "react";

export const SaveCrop = ({ file }: { file: File }) => {
  const cropper = useRef<CropperApi>(null);
  const [loaded, setLoaded] = useState<File | null>(null);

  const save = async () => {
    if (!cropper.current) return;
    const result = await exportCrop(cropper.current, {
      type: "image/webp",
      maxSize: { width: 2048, height: 2048 },
    }).catch((error: unknown) => {
      console.error(error);
      return null;
    });
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
        onClick={save}
      >
        save
      </button>
    </>
  );
};
