"use client";

import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

export interface RotateProps extends PartProps<"button", object> {
  /** Turn direction. @default "ccw" like Photos */
  direction?: "ccw" | "cw";
}

export const Rotate: Part<RotateProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  RotateProps
>(function Rotate({ direction = "ccw", render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.rotate90(direction, { event: event.nativeEvent });
    },
    [cropper, direction]
  );
  return useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "rotate", onClick, type: "button" },
      props
    ),
    ref,
    render,
    state: {},
    tag: "button",
  });
});
