"use client";

import { areaKeyHandlers, bindArea } from "@zriz/core/dom";
import { warnUnlabelled } from "@zriz/react/warn";
import { forwardRef, useContext, useCallback, useState } from "react";

import { useCropperContext } from "../context";
import { RootContextValue, nativeProps, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export interface AreaState {
  shape: "rect" | "circle";
  interacting: boolean;
}

export interface AreaProps extends PartProps<"div", AreaState> {
  /** Write --zriz-rotation, --zriz-zoom, their -progress and --zriz-overscroll on this element each frame. */
  liveVariables?: boolean;
}

export const Area: Part<AreaProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  AreaProps
>(function Area({ liveVariables = false, ...props }, ref) {
  const cropper = useCropperContext();
  const { shape, instructions } = useContext(RootContextValue);
  const interacting = useCropperState((s) => s.interacting !== null);
  const [keys] = useState(() => areaKeyHandlers(cropper));
  const own = useCallback(
    (element: HTMLDivElement) => {
      warnUnlabelled("Area", element);
      return bindArea(cropper, element, { liveVariables });
    },
    [cropper, liveVariables]
  );
  return usePart(
    "div",
    {
      "aria-describedby": instructions,
      "data-interacting": interacting ? "" : undefined,
      "data-shape": shape,
      "data-zriz-item": "area",
      ...nativeProps(keys),
      role: "group",
      style: shape === "circle" ? { borderRadius: "50%" } : undefined,
      tabIndex: 0,
    },
    props,
    useMergedRef(own, ref),
    { interacting, shape }
  );
});
