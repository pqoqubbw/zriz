"use client";

import { forwardRef } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export interface ResetState {
  pristine: boolean;
}

export type ResetProps = PartProps<"button", ResetState>;

export const Reset: Part<ResetProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  ResetProps
>(function Reset(props, ref) {
  const cropper = useCropperContext();
  const pristine = useCropperState((s) => s.pristine);
  const onClick = (event: React.MouseEvent): void => {
    cropper.reset({ event: event.nativeEvent });
  };
  return usePart(
    "button",
    {
      "data-pristine": pristine ? "" : undefined,
      "data-zriz-item": "reset",
      hidden: pristine,
      onClick,
      type: "button",
    },
    props,
    ref,
    { pristine }
  );
});
