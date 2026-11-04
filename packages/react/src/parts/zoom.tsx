"use client";

import { zoomAria, zoomHandlers } from "@zriz/core/dom";
import { warnUnlabelled } from "@zriz/react/warn";
import { forwardRef, useContext, useCallback, useMemo } from "react";

import { useCropperContext } from "../context";
import {
  RootContextValue,
  nativeProps,
  useElementBox,
  useLatest,
  useMergedRef,
  useRelease,
} from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export interface ZoomState {
  dragging: boolean;
}

export interface ZoomProps extends PartProps<"div", ZoomState> {
  /** Highest zoom the slider reaches. @default maxZoom on Root */
  max?: number | undefined;
  /** Formatting of the spoken value. @default percent */
  format?: Intl.NumberFormatOptions | undefined;
}

export const Zoom: Part<ZoomProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ZoomProps
>(function Zoom({ max, format, ...props }, ref) {
  const cropper = useCropperContext();
  const { dir, locale } = useContext(RootContextValue);
  const box = useElementBox();
  const latest = useLatest({ dir, max });
  const handlers = useMemo(
    () => zoomHandlers(cropper, () => latest.current, box.get),
    [box, cropper, latest]
  );
  useRelease(handlers);
  const dragging = useCropperState((s) => s.interacting === "zoom-control");
  const disabled = useCropperState((s) => s.disabled);
  const own = useCallback(
    (node: HTMLDivElement) => {
      const clear = box.set(node);
      warnUnlabelled("Zoom", node);
      const off = zoomAria(cropper, node, { format, locale, max });
      return () => {
        clear();
        off();
      };
    },
    [box, cropper, format, locale, max]
  );
  return usePart(
    "div",
    {
      "aria-disabled": disabled ? true : undefined,
      "aria-orientation": "horizontal",
      "data-dragging": dragging ? "" : undefined,
      "data-zriz-item": "zoom",
      ...nativeProps(handlers),
      role: "slider",
      style: {
        WebkitTapHighlightColor: "transparent",
        position: "relative",
        touchAction: "none",
      },
      tabIndex: 0,
    },
    props,
    useMergedRef(own, ref),
    { dragging }
  );
});
