"use client";

import { viewportController } from "@zriz/core/dom";
import type { WheelMode } from "@zriz/core/dom";
import { warnViewports } from "@zriz/react/warn";
import { forwardRef, useCallback, useEffect, useMemo } from "react";

import { useCropperContext } from "../context";
import { nativeProps, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

type ViewportState = {
  interacting: boolean;
};

type ViewportProps = PartProps<"div", ViewportState> & {
  /** What a plain mouse wheel or two-finger trackpad drag does. @default "pan" */
  wheel?: WheelMode | undefined;
  /** Two fingers also straighten the photo. @default true */
  rotateGesture?: boolean | undefined;
};

const Viewport: Part<ViewportProps, HTMLDivElement> = forwardRef<
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
      const leave = warnViewports(cropper, element);

      return () => {
        leave();
        controller.setElement(null);
      };
    },
    [controller, cropper]
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

export type { ViewportProps, ViewportState };
export { Viewport };
