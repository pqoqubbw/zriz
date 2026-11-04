"use client";

import { forwardRef } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { useAriaDisabled } from "../use-cropper";
import { usePart } from "../use-render";

export interface ZoomStepProps extends PartProps<"button", object> {
  /** Multiplies the zoom on each press, below 1 zooms out. */
  factor: number;
}

export const ZoomStep: Part<ZoomStepProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  ZoomStepProps
>(function ZoomStep({ factor, ...props }, ref) {
  const cropper = useCropperContext();
  const onClick = (event: React.MouseEvent): void => {
    cropper.setZoom(cropper.getZoom() * factor, {
      event: event.nativeEvent,
      reason: "zoom-control",
    });
  };
  return usePart(
    "button",
    {
      "aria-disabled": useAriaDisabled(),
      "data-zriz-item": "zoom-step",
      onClick,
      type: "button",
    },
    props,
    ref,
    {}
  );
});
