"use client";

import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

export interface ZoomStepProps extends PartProps<"button", object> {
  /** Multiplies the zoom on each press, below 1 zooms out. */
  factor: number;
}

export const ZoomStep: Part<ZoomStepProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  ZoomStepProps
>(function ZoomStep({ factor, render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.setZoom(cropper.getZoom() * factor, {
        event: event.nativeEvent,
        reason: "zoom-control",
      });
    },
    [cropper, factor]
  );
  return useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "zoom-step", onClick, type: "button" },
      props
    ),
    ref,
    render,
    state: {},
    tag: "button",
  });
});
