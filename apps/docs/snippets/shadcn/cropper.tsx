"use client";

import type { Cropper as CropperApi } from "@zriz/react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Cropper,
  CropperViewport,
  CropperZoom,
  CropperZoomIn,
  CropperZoomOut,
  cropToFile,
} from "@/components/ui/cropper";

type Props = { photo: File; onCrop: (file: File) => void };

export const PhotoCropper = ({ photo, onCrop }: Props) => {
  const actions = useRef<CropperApi>(null);

  const crop = async () => {
    if (actions.current) {
      onCrop(
        await cropToFile(actions.current, {
          type: "image/webp",
        })
      );
    }
  };

  return (
    <Cropper actionsRef={actions} src={photo}>
      <CropperViewport />
      <div className="flex items-center gap-1">
        <CropperZoomOut />
        <CropperZoom />
        <CropperZoomIn />
      </div>
      <Button onClick={crop}>Crop</Button>
    </Cropper>
  );
};
