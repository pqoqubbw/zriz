"use client";

import { forwardRef } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { useAriaDisabled } from "../use-cropper";
import { usePart } from "../use-render";

export type RotateProps = {
  /** Turn direction. @default "ccw" like Photos */
  direction?: "ccw" | "cw" | undefined;
} & PartProps<"button", object>;

export const Rotate: Part<RotateProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  RotateProps
>(function Rotate({ direction = "ccw", ...props }, ref) {
  const cropper = useCropperContext();

  const onClick = (event: MouseEvent): void => {
    cropper.rotate90(direction, { event: event.nativeEvent });
  };

  return usePart(
    "button",
    {
      "aria-disabled": useAriaDisabled(),
      "data-zriz-item": "rotate",
      onClick,
      type: "button",
    },
    props,
    ref,
    {}
  );
});
