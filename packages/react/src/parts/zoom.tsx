"use client";

import { zoomAria, zoomHandlers } from "@zriz/core/dom";
import { warnFormat, warnUnlabelled } from "@zriz/react/warn";
import { forwardRef, useContext, useCallback, useMemo, useState } from "react";

import { useCropperContext } from "../context";
import {
  RootContext,
  keepStyle,
  nativeProps,
  useElementBox,
  useLatest,
  useMergedRef,
  useRelease,
  useSameJson,
} from "../part";
import type { Part, PartProps } from "../part";
import { firstZoom, useAriaDisabled, useCropperState } from "../use-cropper";
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

const STYLE = {
  WebkitTapHighlightColor: "transparent",
  WebkitUserSelect: "none",
  position: "relative",
  touchAction: "none",
  userSelect: "none",
} as const;

const keep = keepStyle(STYLE);

export const Zoom: Part<ZoomProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ZoomProps
>(function Zoom({ max, format, ...props }, ref) {
  const cropper = useCropperContext();
  const { dir, locale } = useContext(RootContext);
  const box = useElementBox();
  const latest = useLatest({ dir, max });
  const handlers = useMemo(
    () => zoomHandlers(cropper, () => latest.current, box.get),
    [box, cropper, latest]
  );
  useRelease(handlers);
  const dragging = useCropperState((s) => s.interacting === "zoom-control");
  const disabled = useAriaDisabled();
  const [first] = useState(() => firstZoom(cropper, max));
  const spoken = useSameJson(format);
  const own = useCallback(
    (node: HTMLDivElement) => {
      keep(node);
      const clear = box.set(node);
      warnUnlabelled("Zoom", node);
      warnFormat("Zoom", locale, spoken);
      const off = zoomAria(cropper, node, { format: spoken, locale, max });
      return () => {
        clear();
        off();
      };
    },
    [box, cropper, spoken, locale, max]
  );
  return usePart(
    "div",
    {
      "aria-disabled": disabled,
      "aria-orientation": "horizontal",
      "aria-valuenow": first,
      "data-dragging": dragging ? "" : undefined,
      "data-zriz-item": "zoom",
      ...nativeProps(handlers),
      role: "slider",
      style: STYLE,
      tabIndex: 0,
    },
    props,
    useMergedRef(own, ref),
    { dragging }
  );
});
