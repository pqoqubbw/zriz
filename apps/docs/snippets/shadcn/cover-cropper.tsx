"use client";

import { CoverCropper } from "@/components/cover-cropper";

type Props = { cover: string; onCrop: (file: File) => void };

export const ProfileCover = ({ cover, onCrop }: Props) => (
  <CoverCropper
    defaultImage={cover}
    aspect={3}
    width={1500}
    onCrop={onCrop}
  />
);
