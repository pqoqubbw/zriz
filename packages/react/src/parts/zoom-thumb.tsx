"use client";

import { bindZoomThumb } from "@zriz/core/dom";
import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

export interface ZoomThumbProps extends PartProps<"div", object> {
  /** Must match the Zoom max. @default 15 */
  max?: number;
}

export const ZoomThumb: Part<ZoomThumbProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ZoomThumbProps
>(function ZoomThumb({ max, render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const own = useCallback(
    (node: HTMLDivElement) => bindZoomThumb(cropper, node, { max }),
    [cropper, max]
  );
  return useRender({
    className,
    props: mergeProps(
      { "aria-hidden": true, "data-zriz-item": "zoom-thumb" },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: {},
    tag: "div",
  });
});
