"use client";

import { bindDialValue } from "@zriz/core/dom";
import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { useLatest, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface DialValueProps extends PartProps<"span", object> {
  /** Text for an angle in degrees. @default the rounded number */
  format?: ((rotation: number) => string) | undefined;
}

export const DialValue: Part<DialValueProps, HTMLSpanElement> = forwardRef<
  HTMLSpanElement,
  DialValueProps
>(function DialValue({ format, ...props }, ref) {
  const cropper = useCropperContext();
  const latest = useLatest(format);
  const own = useCallback(
    (node: HTMLSpanElement) =>
      bindDialValue(cropper, node, (rotation) =>
        latest.current ? latest.current(rotation) : String(Math.round(rotation))
      ),
    [cropper, latest]
  );
  return usePart(
    "span",
    { "aria-hidden": true, "data-zriz-item": "dial-value" },
    props,
    useMergedRef(own, ref),
    {}
  );
});
