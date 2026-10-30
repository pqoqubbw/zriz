"use client";

import { bindZoomThumb, zoomAria, zoomHandlers } from "@zriz/core/dom";
import { use, useCallback, useMemo } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, native, useElementBox, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";
import { warnUnlabelled } from "../warn";

export interface ZoomState {
  dragging: boolean;
}

export interface ZoomProps extends PartProps<"div", ZoomState> {
  /** Highest zoom the slider reaches. @default 15 */
  max?: number;
  /** Formatting of the spoken value. @default percent */
  format?: Intl.NumberFormatOptions;
}

export const Zoom = ({
  max,
  format,
  render,
  className,
  ref,
  ...props
}: ZoomProps): ReactElement => {
  const cropper = useCropperContext();
  const { dir, locale } = use(RootContextValue);
  const box = useElementBox();
  const handlers = useMemo(
    () => zoomHandlers(cropper, { dir, max }, box.get),
    [box, cropper, dir, max]
  );
  const dragging = useCropperState((s) => s.interacting === "zoom-control");
  const own = useCallback(
    (node: HTMLDivElement | null) => {
      box.set(node);
      warnUnlabelled("Zoom", node);
      const off = node
        ? zoomAria(cropper, node, { format, locale, max })
        : undefined;
      return () => {
        box.set(null);
        off?.();
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
};

export interface ZoomThumbProps extends PartProps<"div", object> {
  /** Must match the Zoom max. @default 15 */
  max?: number;
}

export const ZoomThumb = ({
  max,
  render,
  className,
  ref,
  ...props
}: ZoomThumbProps): ReactElement => {
  const cropper = useCropperContext();
  const own = useCallback(
    (node: HTMLDivElement | null) =>
      node ? bindZoomThumb(cropper, node, { max }) : undefined,
    [cropper, max]
  );
  return useRender({
    className,
    props: mergeProps(
      { "aria-hidden": true, "data-zriz-item": "zoom-thumb" },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: {},
    tag: "div",
  });
};

export interface ZoomStepProps extends PartProps<"button", object> {
  /** Multiplies the zoom on each press, below 1 zooms out. */
  factor: number;
}

export const ZoomStep = ({
  factor,
  render,
  className,
  ref,
  ...props
}: ZoomStepProps): ReactElement => {
  const cropper = useCropperContext();
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.setZoom(cropper.getZoom() * factor, {
        event: event.nativeEvent,
        reason: "zoom-control",
      });
    },
    [cropper, factor]
  );
  return useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "zoom-step", onClick, type: "button" },
      props
    ),
    ref,
    render,
    state: {},
    tag: "button",
  });
};
