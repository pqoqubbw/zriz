"use client";

import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface FlipState {
  mirrored: boolean;
}

export interface FlipProps extends PartProps<"button", FlipState> {
  /** Mirror axis. @default "x" */
  axis?: "x" | "y";
}

export const Flip: Part<FlipProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  FlipProps
>(function Flip({ axis = "x", render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const mirrored = useCropperState((s) => s.mirrored);
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.flip(axis, { event: event.nativeEvent });
    },
    [cropper, axis]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-pressed": mirrored,
        "data-mirrored": mirrored ? "" : undefined,
        "data-zriz-item": "flip",
        onClick,
        type: "button",
      },
      props
    ),
    ref,
    render,
    state: { mirrored },
    tag: "button",
  });
});
