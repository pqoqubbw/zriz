"use client";

import { DIAL_TICKS, bindDialTicks, tickData } from "@zriz/core/dom";
import { useCallback } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useRender } from "../use-render";

export interface DialTicksState {
  count: number;
}

export interface DialTicksProps extends PartProps<"div", DialTicksState> {
  /** Number of ticks across ±45°. @default 41 */
  count?: number;
}

export const DialTicks = ({
  count = DIAL_TICKS,
  render,
  className,
  ref,
  ...props
}: DialTicksProps): ReactElement => {
  const cropper = useCropperContext();
  const own = useCallback(
    (node: HTMLDivElement | null) =>
      node ? bindDialTicks(cropper, node, count) : undefined,
    [cropper, count]
  );
  const ticks = Array.from({ length: count }, (_, i) => {
    const data = tickData(i, count);
    return (
      <span
        data-fade={data.fade ?? undefined}
        data-major={data.major ? "" : undefined}
        data-zero={data.zero ? "" : undefined}
        key={i}
      />
    );
  });
  return useRender({
    className,
    props: mergeProps(
      { "aria-hidden": true, children: ticks, "data-zriz-item": "dial-ticks" },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { count },
    tag: "div",
  });
};
