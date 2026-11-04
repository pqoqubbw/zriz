"use client";

import { viewportController } from "@zriz/core/dom";
import type { WheelMode } from "@zriz/core/dom";
import { forwardRef, useCallback, useEffect, useMemo } from "react";

import { useCropperContext } from "../context";
import { nativeProps, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export type ViewportState = {
  interacting: boolean;
};

export type ViewportProps = {
  /** What a plain mouse wheel or two-finger trackpad drag does. @default "pan" */
  wheel?: WheelMode | undefined;
  /** Two fingers also straighten the photo. @default true */
  rotateGesture?: boolean | undefined;
} & PartProps<"div", ViewportState>;

export const Viewport: Part<ViewportProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ViewportProps
>(function Viewport({ wheel = "pan", rotateGesture = true, ...props }, ref) {
  const cropper = useCropperContext();
  const controller = useMemo(() => viewportController(cropper), [cropper]);

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
