"use client";

import { AvatarCropper } from "@/components/avatar-cropper";

const upload = async (file: File) => {
  const body = new FormData();

  body.append("avatar", file);
  await fetch("/api/avatar", { method: "POST", body });
};

export const ProfilePhoto = () => (
  <AvatarCropper onCrop={upload} />
);
