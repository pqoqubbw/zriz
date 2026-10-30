"use client";

import { areaKeyHandlers, bindArea } from "@zriz/core/dom";
import { use, useCallback, useState } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, native, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";
import { warnUnlabelled } from "../warn";

export interface AreaState {
  shape: "rect" | "circle";
  interacting: boolean;
}

export interface AreaProps extends PartProps<"div", AreaState> {
  /** Write --zriz-rotation, --zriz-zoom, their -progress and --zriz-overscroll on this element each frame. */
  liveVariables?: boolean;
}

export const Area = ({
  liveVariables = false,
  render,
  className,
  ref,
  ...props
}: AreaProps): ReactElement => {
  const cropper = useCropperContext();
  const { shape, instructions } = use(RootContextValue);
  const interacting = useCropperState((s) => s.interacting !== null);
  const [keys] = useState(() => areaKeyHandlers(cropper));
  const own = useCallback(
    (element: HTMLDivElement | null) => {
      warnUnlabelled("Area", element);
      return element
        ? bindArea(cropper, element, { liveVariables })
        : undefined;
    },
    [cropper, liveVariables]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-describedby": instructions,
        "data-interacting": interacting ? "" : undefined,
        "data-shape": shape,
        "data-zriz-item": "area",
        onBlur: native(keys.onBlur),
        onKeyDown: native(keys.onKeyDown),
        onKeyUp: native(keys.onKeyUp),
        role: "group",
        tabIndex: 0,
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { interacting, shape },
    tag: "div",
  });
};
