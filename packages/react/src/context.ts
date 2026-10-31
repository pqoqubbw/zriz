"use client";

import type { Cropper } from "@zriz/core";
import { createContext, useContext } from "react";

export const CropperContext: React.Context<Cropper | null> =
  createContext<Cropper | null>(null);

export const useCropperContext = (): Cropper => {
  const cropper = useContext(CropperContext);
  if (!cropper) {
    throw new Error("zriz: parts must be inside <Cropper.Root>");
  }
  return cropper;
};
