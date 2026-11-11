"use client";

import { useState } from "react";

import { ImageCropDialog } from "@/components/image-crop-dialog";

type Props = { onCrop: (file: File) => void };

export const ProductPhoto = ({ onCrop }: Props) => {
  const [photo, setPhoto] = useState<File | null>(null);

  return (
    <>
      <input
        aria-label="Product photo"
        type="file"
        accept="image/*"
        onChange={(event) =>
          setPhoto(event.target.files?.[0] ?? null)
        }
      />
      <ImageCropDialog
        image={photo}
        open={photo !== null}
        onOpenChange={(open) => {
          if (!open) setPhoto(null);
        }}
        aspects={[
          { label: "1:1", value: 1 },
          { label: "4:3", value: 4 / 3 },
        ]}
        exportOptions={{ type: "image/webp", quality: 0.9 }}
        onCrop={onCrop}
      />
    </>
  );
};
