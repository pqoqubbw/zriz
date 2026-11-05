"use client";

import { forwardRef } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { PRESS, usePressRef } from "../press";
import { useAriaDisabled } from "../use-cropper";
import { usePart } from "../use-render";

type ZoomStepProps = PartProps<"button", object> & {
  /** Multiplies the zoom on each press, below 1 zooms out. */
  factor: number;
};

const ZoomStep: Part<ZoomStepProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  ZoomStepProps
>(function ZoomStep({ factor, ...props }, ref) {
  const cropper = useCropperContext();

  const onClick = (event: MouseEvent): void => {
    cropper.setZoom(cropper.getZoom() * factor, {
      event: event.nativeEvent,
      reason: "zoom-control",
    });
  };

  return usePart(
    "button",
    {
      "aria-disabled": useAriaDisabled(),
      "data-zriz-item": "zoom-step",
      onClick,
      style: PRESS,
      type: "button",
    },
    props,
    usePressRef(ref),
    {}
  );
});

export type { ZoomStepProps };
export { ZoomStep };
