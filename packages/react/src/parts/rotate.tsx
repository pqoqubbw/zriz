"use client";

import { forwardRef } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { PRESS, usePressRef } from "../press";
import { useAriaDisabled } from "../use-cropper";
import { usePart } from "../use-render";

type RotateProps = PartProps<"button", object> & {
  /** Turn direction. @default "ccw" like Photos */
  direction?: "ccw" | "cw" | undefined;
};

const Rotate: Part<RotateProps, HTMLButtonElement> = forwardRef<
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
      style: PRESS,
      type: "button",
    },
    props,
    usePressRef(ref),
    {}
  );
});

export type { RotateProps };
export { Rotate };
