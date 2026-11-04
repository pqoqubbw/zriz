"use client";

import { sameAspect } from "@zriz/core";
import type { Aspect } from "@zriz/core";
import { forwardRef, useContext } from "react";
import type { MouseEvent } from "react";

import { AspectGroupContext } from "../aspect-group-context";
import { useCropperContext } from "../context";
import { RootContext } from "../part";
import type { Part, PartProps } from "../part";
import { useAriaDisabled, useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export type AspectItemState = {
  checked: boolean;
  disabled: boolean;
};

export type AspectItemProps = {
  /** The aspect this item selects: a ratio, "free" or "original". */
  value: Aspect;
} & PartProps<"button", AspectItemState>;

export const AspectItem: Part<AspectItemProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  AspectItemProps
>(function AspectItem({ value, disabled: off, ...props }, ref) {
  const cropper = useCropperContext();
  const inGroup = useContext(AspectGroupContext);
  const { shape } = useContext(RootContext);
  const disabled = off === true || (shape === "circle" && value !== 1);
  const checked = useCropperState((s) => sameAspect(s.aspect, value));
  const rootDisabled = useAriaDisabled();

  const onClick = (event: MouseEvent): void => {
    if (!disabled) {
      cropper.setAspect(value, { event: event.nativeEvent });
    }
  };

  let tabStop: number | undefined;

  if (inGroup) {
    tabStop = checked ? 0 : -1;
  }

  return usePart(
    "button",
    {
      "aria-checked": inGroup ? checked : undefined,
      "aria-disabled": disabled || rootDisabled,
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
