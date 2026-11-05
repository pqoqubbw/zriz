"use client";

import { areaKeyHandlers, bindArea } from "@zriz/core/dom";
import { warnUnlabelled } from "@zriz/react/warn";
import { forwardRef, useCallback, useContext, useMemo } from "react";
import type { CSSProperties } from "react";

import { useCropperContext } from "../context";
import { RootContext, nativeProps, useMergedRef, useRelease } from "../part";
import type { Part, PartProps } from "../part";
import { useAriaDisabled, useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

type AreaState = {
  shape: "rect" | "circle";
  interacting: boolean;
};

type AreaProps = PartProps<"div", AreaState> & {
  /** Write --zriz-rotation, --zriz-zoom, their -progress and --zriz-overscroll on this element each frame. */
  liveVariables?: boolean | undefined;
};

const SQUARE: CSSProperties = { position: "absolute" };
const ROUND: CSSProperties = { ...SQUARE, borderRadius: "50%" };

const Area: Part<AreaProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  AreaProps
>(function Area({ liveVariables = false, ...props }, ref) {
  const cropper = useCropperContext();
  const { shape, instructions } = useContext(RootContext);
  const interacting = useCropperState((s) => s.interacting !== null);
  const ready = useCropperState((s) => s.ready);
  const keys = useMemo(() => areaKeyHandlers(cropper), [cropper]);

  useRelease(keys);
  const own = useCallback(
    (element: HTMLDivElement) => {
      warnUnlabelled("Area", element);

      if (element.dataset.shape === "circle" && !element.style.borderRadius) {
        element.style.borderRadius = "50%";
      }

      return bindArea(cropper, element, { liveVariables });
    },
    [cropper, liveVariables]
  );

  return usePart(
    "div",
    {
      "aria-describedby": instructions,
      "aria-disabled": useAriaDisabled(),
      "data-interacting": interacting ? "" : undefined,
      "data-shape": shape,
      "data-zriz-item": "area",
      ...nativeProps(keys),
      role: "application",
      style: shape === "circle" ? ROUND : SQUARE,
      tabIndex: ready ? 0 : -1,
    },
    props,
    useMergedRef(own, ref),
    { interacting, shape }
  );
});

export type { AreaProps, AreaState };
export { Area };
