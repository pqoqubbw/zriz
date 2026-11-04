"use client";

import { sameAspect } from "@zriz/core";
import type { Aspect } from "@zriz/core";
import { forwardRef, useContext } from "react";

import { AspectGroupContext } from "../buttons-context";
import { useCropperContext } from "../context";
import { RootContextValue } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export interface AspectItemState {
  checked: boolean;
  disabled: boolean;
}

export interface AspectItemProps extends PartProps<"button", AspectItemState> {
  /** The aspect this item selects: a ratio, "free" or "original". */
  value: Aspect;
}

export const AspectItem: Part<AspectItemProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  AspectItemProps
>(function AspectItem({ value, ...props }, ref) {
  const cropper = useCropperContext();
  const inGroup = useContext(AspectGroupContext);
  const { shape } = useContext(RootContextValue);
  const disabled = shape === "circle" && value !== 1;
  const checked = useCropperState((s) => sameAspect(s.aspect, value));
  const onClick = (event: React.MouseEvent): void => {
    cropper.setAspect(value, { event: event.nativeEvent });
  };
  let tabStop: number | undefined;
  if (inGroup) {
    tabStop = checked ? 0 : -1;
  }
  return usePart(
    "button",
    {
      "aria-checked": inGroup ? checked : undefined,
      "aria-pressed": inGroup ? undefined : checked,
      "data-checked": checked ? "" : undefined,
      "data-disabled": disabled ? "" : undefined,
      "data-zriz-item": "aspect-item",
      disabled,
      onClick,
      role: inGroup ? "radio" : undefined,
      tabIndex: tabStop,
      type: "button",
    },
    props,
    ref,
    { checked, disabled }
  );
});
