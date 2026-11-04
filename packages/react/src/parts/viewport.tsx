"use client";

import { viewportController } from "@zriz/core/dom";
import type { WheelMode } from "@zriz/core/dom";
import { forwardRef, useCallback, useEffect, useState } from "react";

import { useCropperContext } from "../context";
import { nativeProps, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export interface ViewportState {
  interacting: boolean;
}

export interface ViewportProps extends PartProps<"div", ViewportState> {
  /** What a plain mouse wheel or two-finger trackpad drag does. @default "pan" */
  wheel?: WheelMode;
  /** Two fingers also straighten the photo. @default true */
  rotateGesture?: boolean;
}

export const Viewport: Part<ViewportProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ViewportProps
>(function Viewport({ wheel = "pan", rotateGesture = true, ...props }, ref) {
  const cropper = useCropperContext();
  const [controller] = useState(() =>
    viewportController(cropper, { rotateGesture, wheel })
  );
  useEffect(() => {
    controller.setOptions({ rotateGesture, wheel });
  }, [controller, rotateGesture, wheel]);
  const own = useCallback(
    (element: HTMLDivElement) => {
      controller.setElement(element);
      return () => {
        controller.setElement(null);
      };
    },
    [controller]
  );
  const interacting = useCropperState((s) => s.interacting !== null);
  const { handlers } = controller;
  return usePart(
    "div",
    {
      "data-zriz-item": "viewport",
      ...nativeProps(handlers),
    },
    props,
    useMergedRef(own, ref),
    { interacting }
  );
});
