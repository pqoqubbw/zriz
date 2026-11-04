"use client";

import { forwardRef } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

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
>(function Flip({ axis = "x", ...props }, ref) {
  const cropper = useCropperContext();
  const mirrored = useCropperState((s) => s.mirrored);
  const onClick = (event: React.MouseEvent): void => {
    cropper.flip(axis, { event: event.nativeEvent });
  };
  return usePart(
    "button",
    {
      "aria-pressed": mirrored,
      "data-mirrored": mirrored ? "" : undefined,
      "data-zriz-item": "flip",
      onClick,
      type: "button",
    },
    props,
    ref,
    { mirrored }
  );
});
