"use client";

import { zoomAria, zoomHandlers } from "@zriz/core/dom";
import { warnUnlabelled } from "@zriz/react/warn";
import { forwardRef, useContext, useCallback, useMemo } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, native, useElementBox, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface ZoomState {
  dragging: boolean;
}

export interface ZoomProps extends PartProps<"div", ZoomState> {
  /** Highest zoom the slider reaches. @default 15 */
  max?: number;
  /** Formatting of the spoken value. @default percent */
  format?: Intl.NumberFormatOptions;
}

export const Zoom: Part<ZoomProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ZoomProps
>(function Zoom({ max, format, render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const { dir, locale } = useContext(RootContextValue);
  const box = useElementBox();
  const handlers = useMemo(
    () => zoomHandlers(cropper, { dir, max }, box.get),
    [box, cropper, dir, max]
  );
  const dragging = useCropperState((s) => s.interacting === "zoom-control");
  const own = useCallback(
    (node: HTMLDivElement) => {
      box.set(node);
      warnUnlabelled("Zoom", node);
      const off = zoomAria(cropper, node, { format, locale, max });
      return () => {
        box.set(null);
        off();
      };
    },
    [box, cropper, format, locale, max]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-orientation": "horizontal",
        "data-dragging": dragging ? "" : undefined,
        "data-zriz-item": "zoom",
        onBlur: native(handlers.onBlur),
        onKeyDown: native(handlers.onKeyDown),
        onKeyUp: native(handlers.onKeyUp),
        onLostPointerCapture: native(handlers.onLostPointerCapture),
        onPointerCancel: native(handlers.onPointerCancel),
        onPointerDown: native(handlers.onPointerDown),
        onPointerMove: native(handlers.onPointerMove),
        onPointerUp: native(handlers.onPointerUp),
        role: "slider",
        style: {
          WebkitTapHighlightColor: "transparent",
          position: "relative",
          touchAction: "none",
        },
        tabIndex: 0,
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { dragging },
    tag: "div",
  });
});
