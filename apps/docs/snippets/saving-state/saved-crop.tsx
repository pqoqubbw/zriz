"use client";

import { parse, serialize } from "@zriz/core";
import type { CropValue } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useState } from "react";

type Props = { id: string; src: string };
type Saved = { id: string; value: CropValue | null };

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const SavedCrop = ({ id, src }: Props) => {
  const key = `zriz-crop:${id}`;
  const [saved, setSaved] = useState<Saved>();

  useEffect(() => {
    setSaved({ id, value: parse(read(key)) });
  }, [id, key]);

  if (saved?.id !== id) return null;

  return (
    <Cropper.Root
      src={src}
      defaultValue={saved.value ?? undefined}
      onValueCommit={(value, details) => {
        if (details.reason === "coverage") return;

        try {
          localStorage.setItem(key, serialize(value));
        } catch (error) {
          console.warn("the crop was not saved", error);
        }
      }}
    >
      <Cropper.Viewport style={{ maxWidth: 640, height: 480 }}>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
    </Cropper.Root>
  );
};
