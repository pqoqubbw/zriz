"use client";

import { bindMask } from "@zriz/core/dom";
import { use, useCallback } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useRender } from "../use-render";

export interface MaskState {
  shape: "rect" | "circle";
}

export type MaskProps = PartProps<"div", MaskState>;

export const Mask = ({
  render,
  className,
  ref,
  ...props
}: MaskProps): ReactElement => {
  const cropper = useCropperContext();
  const { shape } = use(RootContextValue);
  const own = useCallback(
    (element: HTMLDivElement | null) =>
      element ? bindMask(cropper, element, shape) : undefined,
    [cropper, shape]
  );
  return useRender({
    className,
    props: mergeProps(
      { "aria-hidden": true, "data-shape": shape, "data-zriz-item": "mask" },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { shape },
    tag: "div",
  });
};
