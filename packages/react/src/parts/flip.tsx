"use client";

import { warnFlips } from "@zriz/react/warn";
import { forwardRef, useEffect } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { PRESS, usePressRef } from "../press";
import { useAriaDisabled, useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

type FlipState = {
  mirrored: boolean;
};

type FlipProps = PartProps<"button", FlipState> & {
  /** Mirror axis. @default "x" */
  axis?: "x" | "y" | undefined;
  /** Exposes the mirror as a pressed state. Only with axis "x". @default false */
  toggle?: boolean | undefined;
};

const Flip: Part<FlipProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  FlipProps
>(function Flip({ axis = "x", toggle = false, ...props }, ref) {
  const cropper = useCropperContext();
  const mirrored = useCropperState((s) => s.mirrored);
  const pressable = toggle && axis === "x";

  useEffect(
    () => warnFlips(cropper, { axis, toggle }),
    [cropper, axis, toggle]
  );

  const onClick = (event: MouseEvent): void => {
    cropper.flip(axis, { event: event.nativeEvent });
  };

  return usePart(
    "button",
    {
      "aria-disabled": useAriaDisabled(),
      "aria-pressed": pressable ? mirrored : undefined,
      "data-mirrored": pressable && mirrored ? "" : undefined,
      "data-zriz-item": "flip",
      onClick,
      style: PRESS,
      type: "button",
    },
    props,
    usePressRef(ref),
    { mirrored }
  );
});

export type { FlipProps, FlipState };
export { Flip };
