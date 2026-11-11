"use client";

import type { CropValue } from "@zriz/react";

import { ImageEditor } from "@/components/image-editor";

type Props = {
  photo: File;
  saved?: CropValue;
  onSave: (file: File, value: CropValue) => void;
};

export const PhotoEditor = ({
  photo,
  saved,
  onSave,
}: Props) => (
  <ImageEditor
    image={photo}
    {...(saved ? { defaultValue: saved } : null)}
    exportOptions={{ type: "image/jpeg", quality: 0.9 }}
    onSave={onSave}
  />
);
