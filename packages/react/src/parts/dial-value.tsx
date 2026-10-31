"use client";

import { bindDialValue } from "@zriz/core/dom";
import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useLatest, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

export interface DialValueProps extends PartProps<"span", object> {
  /** Text for an angle in degrees. @default the rounded number */
  format?: (rotation: number) => string;
}

export const DialValue: Part<DialValueProps, HTMLSpanElement> = forwardRef<
  HTMLSpanElement,
  DialValueProps
>(function DialValue({ format, render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const latest = useLatest(format);
  const own = useCallback(
    (node: HTMLSpanElement) =>
      bindDialValue(cropper, node, (rotation) =>
        latest.current ? latest.current(rotation) : String(Math.round(rotation))
      ),
    [cropper, latest]
  );
  return useRender({
    className,
    props: mergeProps(
      { "aria-hidden": true, "data-zriz-item": "dial-value" },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: {},
    tag: "span",
  });
});
