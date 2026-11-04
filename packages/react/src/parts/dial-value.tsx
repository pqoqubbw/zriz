"use client";

import { bindDialValue } from "@zriz/core/dom";
import { forwardRef, useCallback, useRef, useState } from "react";

import { useCropperContext } from "../context";
import { useIsomorphicLayoutEffect, useLatest, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface DialValueProps extends Omit<
  PartProps<"span", object>,
  "children" | "dangerouslySetInnerHTML"
> {
  /** Text for an angle in degrees. @default the rounded number */
  format?: ((rotation: number) => string) | undefined;
}

export const DialValue: Part<DialValueProps, HTMLSpanElement> = forwardRef<
  HTMLSpanElement,
  DialValueProps
>(function DialValue({ format, ...props }, ref) {
  const cropper = useCropperContext();
  const latest = useLatest(format);
  const node = useRef<HTMLElement | null>(null);
  const [text] = useState(
    () =>
      (rotation: number): string | undefined =>
        latest.current?.(rotation)
  );
  const own = useCallback(
    (span: HTMLSpanElement) => {
      node.current = span;
      return bindDialValue(cropper, span, text);
    },
    [cropper, text]
  );
  useIsomorphicLayoutEffect(() => {
    if (node.current) {
      bindDialValue(cropper, node.current, text)();
    }
  });
  const bare = {
    ...props,
    children: undefined,
    dangerouslySetInnerHTML: undefined,
  };
  return usePart(
    "span",
    { "aria-hidden": true, "data-zriz-item": "dial-value" },
    bare,
    useMergedRef(own, ref),
    {}
  );
});
