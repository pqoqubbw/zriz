"use client";

import { forwardRef } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { PRESS } from "../press";
import { useAriaDisabled, useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

type FlipState = {
  mirrored: boolean;
};

type FlipProps = PartProps<"button", FlipState> & {
  /** Mirror axis. @default "x" */
  axis?: "x" | "y" | undefined;
};

const Flip: Part<FlipProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  FlipProps
>(function Flip({ axis = "x", ...props }, ref) {
  const cropper = useCropperContext();
  const mirrored = useCropperState((s) => s.mirrored);

  const onClick = (event: MouseEvent): void => {
    cropper.flip(axis, { event: event.nativeEvent });
  };

  return usePart(
    "button",
    {
      "aria-disabled": useAriaDisabled(),
      "aria-pressed": mirrored,
      "data-mirrored": mirrored ? "" : undefined,
      "data-zriz-item": "flip",
      style: PRESS,
      onClick,
      type: "button",
    },
    props,
    ref,
    { mirrored }
  );
});

export type { FlipProps, FlipState };
export { Flip };
