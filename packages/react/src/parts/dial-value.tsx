"use client";

import { bindDialValue } from "@zriz/core/dom";
import { useCallback } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useLatest, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useRender } from "../use-render";

export interface DialValueProps extends PartProps<"span", object> {
  /** Text for an angle in degrees. @default the rounded number */
  format?: (rotation: number) => string;
}

export const DialValue = ({
  format,
  render,
  className,
  ref,
  ...props
}: DialValueProps): ReactElement => {
  const cropper = useCropperContext();
  const latest = useLatest(format);
  const own = useCallback(
    (node: HTMLSpanElement | null) =>
      node
        ? bindDialValue(cropper, node, (rotation) =>
            latest.current
              ? latest.current(rotation)
              : String(Math.round(rotation))
          )
        : undefined,
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
};
