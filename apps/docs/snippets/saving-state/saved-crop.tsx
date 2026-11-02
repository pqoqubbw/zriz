"use client";

import { parse, serialize } from "@zriz/core";
import type { CropValue } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useState } from "react";

type Props = { id: string; src: string };
type Saved = { id: string; value: CropValue | null };

export const SavedCrop = ({ id, src }: Props) => {
  const key = `zriz-crop:${id}`;
  const [saved, setSaved] = useState<Saved>();

  useEffect(() => {
    setSaved({ id, value: parse(localStorage.getItem(key)) });
  }, [id, key]);

  if (saved?.id !== id) return null;

  return (
    <Cropper.Root
      src={src}
      defaultValue={saved.value ?? undefined}
      onValueCommit={(value) => {
        localStorage.setItem(key, serialize(value));
      }}
    >
      <Cropper.Viewport style={{ width: 640, height: 480 }}>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
    </Cropper.Root>
  );
};
