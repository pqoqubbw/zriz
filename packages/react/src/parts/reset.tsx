"use client";

import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface ResetState {
  pristine: boolean;
}

export type ResetProps = PartProps<"button", ResetState>;

export const Reset: Part<ResetProps, HTMLButtonElement> = forwardRef<
  HTMLButtonElement,
  ResetProps
>(function Reset({ render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const pristine = useCropperState((s) => s.pristine);
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.reset({ event: event.nativeEvent });
    },
    [cropper]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "data-pristine": pristine ? "" : undefined,
        "data-zriz-item": "reset",
        hidden: pristine,
        onClick,
        type: "button",
      },
      props
    ),
    ref,
    render,
    state: { pristine },
    tag: "button",
  });
});
