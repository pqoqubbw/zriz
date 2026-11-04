"use client";

import { bindMask } from "@zriz/core/dom";
import { forwardRef, useCallback, useContext } from "react";

import { useCropperContext } from "../context";
import { RootContext, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

type MaskState = {
  shape: "rect" | "circle";
};

type MaskProps = PartProps<"div", MaskState>;

const Mask: Part<MaskProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  MaskProps
>(function Mask(props, ref) {
  const cropper = useCropperContext();
  const { shape } = useContext(RootContext);
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

export type { MaskProps, MaskState };
export { Mask };
