"use client";

import { bindZoomThumb } from "@zriz/core/dom";
import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface ZoomThumbProps extends PartProps<"div", object> {
  /** Must match the Zoom max. @default maxZoom on Root */
  max?: number;
}

export const ZoomThumb: Part<ZoomThumbProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ZoomThumbProps
>(function ZoomThumb({ max, ...props }, ref) {
  const cropper = useCropperContext();
  const own = useCallback(
    (node: HTMLDivElement) => bindZoomThumb(cropper, node, { max }),
    [cropper, max]
  );
  return usePart(
    "div",
    { "aria-hidden": true, "data-zriz-item": "zoom-thumb" },
    props,
    useMergedRef(own, ref),
    {}
  );
});
