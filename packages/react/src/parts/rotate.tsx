"use client";

import { forwardRef } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface RotateProps extends PartProps<"button", object> {
  /** Turn direction. @default "ccw" like Photos */
  direction?: "ccw" | "cw";
}

export const Rotate: Part<RotateProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  RotateProps
>(function Rotate({ direction = "ccw", ...props }, ref) {
  const cropper = useCropperContext();
  const onClick = (event: React.MouseEvent): void => {
    cropper.rotate90(direction, { event: event.nativeEvent });
  };
  return usePart(
    "button",
    { "data-zriz-item": "rotate", onClick, type: "button" },
    props,
    ref,
    {}
  );
});
