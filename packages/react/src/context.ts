"use client";

import type { Cropper } from "@zriz/core";
import { createContext, useContext } from "react";
import type { Context } from "react";

const CropperContext: Context<Cropper | null> = createContext<Cropper | null>(
  null
);

const useCropperContext = (): Cropper => {
  const cropper = useContext(CropperContext);

  if (!cropper) {
    throw new Error("zriz: parts must be inside <Cropper.Root>");
  }

  return cropper;
};

export { CropperContext, useCropperContext };
