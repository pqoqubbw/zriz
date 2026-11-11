"use client";

import { PHOTO } from "@/registry/demos/photo";
import {
  Cropper,
  CropperViewport,
  CropperZoom,
  CropperZoomIn,
  CropperZoomOut,
} from "@/registry/new-york/ui/cropper";

const CropperDemo = () => (
  <Cropper className="max-w-sm" src={PHOTO}>
    <CropperViewport className="aspect-[4/3]" />
    <div className="flex items-center gap-1">
      <CropperZoomOut />
      <CropperZoom />
      <CropperZoomIn />
    </div>
  </Cropper>
);

export default CropperDemo;
