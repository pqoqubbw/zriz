"use client";

import { viewportController } from "@zriz/core/dom";
import type { WheelMode } from "@zriz/core/dom";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { native, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface ViewportState {
  interacting: boolean;
}

export interface ViewportProps extends PartProps<"div", ViewportState> {
  /** What a plain mouse wheel or two-finger trackpad drag does. @default "pan" */
  wheel?: WheelMode;
  /** Two fingers also straighten the photo. @default true */
  rotateGesture?: boolean;
}

export const Viewport = ({
  wheel = "pan",
  rotateGesture = true,
  render,
  className,
  ref,
  ...props
}: ViewportProps): ReactElement => {
  const cropper = useCropperContext();
  const [controller] = useState(() =>
    viewportController(cropper, { rotateGesture, wheel })
  );
  useEffect(() => {
    controller.setOptions({ rotateGesture, wheel });
  }, [controller, rotateGesture, wheel]);
  const own = useCallback(
    (element: HTMLDivElement | null) => {
      controller.setElement(element);
      return () => {
        controller.setElement(null);
      };
    },
    [controller]
  );
  const interacting = useCropperState((s) => s.interacting !== null);
  const { handlers } = controller;
  return useRender({
    className,
    props: mergeProps(
      {
        "data-zriz-item": "viewport",
        onLostPointerCapture: native(handlers.onLostPointerCapture),
        onPointerCancel: native(handlers.onPointerCancel),
        onPointerDown: native(handlers.onPointerDown),
        onPointerMove: native(handlers.onPointerMove),
        onPointerUp: native(handlers.onPointerUp),
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { interacting },
    tag: "div",
  });
};
