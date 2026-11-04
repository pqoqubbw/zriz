"use client";

import { DIAL_TICKS, bindDialTicks, tickData } from "@zriz/core/dom";
import { forwardRef, useCallback, useMemo } from "react";

import { useCropperContext } from "../context";
import { useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export type DialTicksState = {
  count: number;
};

export type DialTicksProps = {
  /** Number of ticks across ±45°. @default 41 */
  count?: number | undefined;
} & PartProps<"div", DialTicksState>;

export const DialTicks: Part<DialTicksProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  DialTicksProps
>(function DialTicks({ count = DIAL_TICKS, ...props }, ref) {
  const cropper = useCropperContext();
  const own = useCallback(
    (node: HTMLDivElement) => bindDialTicks(cropper, node, count),
    [cropper, count]
  );
  const ticks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const data = tickData(i, count);

        return (
          <span
            data-fade={data.fade ?? undefined}
            data-major={data.major ? "" : undefined}
            data-zero={data.zero ? "" : undefined}
            key={i}
          />
        );
      }),
    [count]
  );

  return usePart(
    "div",
    { "aria-hidden": true, children: ticks, "data-zriz-item": "dial-ticks" },
    props,
    useMergedRef(own, ref),
    { count }
  );
});
