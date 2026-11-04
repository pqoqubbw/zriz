"use client";

import { bindMask } from "@zriz/core/dom";
import { forwardRef, useContext, useCallback } from "react";

import { useCropperContext } from "../context";
import { RootContextValue, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface MaskState {
  shape: "rect" | "circle";
}

export type MaskProps = PartProps<"div", MaskState>;

export const Mask: Part<MaskProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  MaskProps
>(function Mask(props, ref) {
  const cropper = useCropperContext();
  const { shape } = useContext(RootContextValue);
  const own = useCallback(
    (element: HTMLDivElement) => bindMask(cropper, element, shape),
    [cropper, shape]
  );
  return usePart(
    "div",
    { "aria-hidden": true, "data-shape": shape, "data-zriz-item": "mask" },
    props,
    useMergedRef(own, ref),
    { shape }
  );
});
