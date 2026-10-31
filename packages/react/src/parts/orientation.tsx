"use client";

import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface OrientationState {
  orientation: "portrait" | "landscape" | "square";
}

export type OrientationProps = PartProps<"button", OrientationState>;

export const Orientation: Part<OrientationProps, HTMLButtonElement> =
  forwardRef<HTMLButtonElement, OrientationProps>(function Orientation(
    { render, className, ...props },
    ref
  ) {
    const cropper = useCropperContext();
    const aspect = useCropperState((s) => s.aspect);
    let orientation: OrientationState["orientation"] = "square";
    if (typeof aspect === "number" && aspect !== 1) {
      orientation = aspect > 1 ? "landscape" : "portrait";
    }
    const onClick = useCallback(
      (event: React.MouseEvent) => {
        const current = cropper.getValue().aspect;
        if (typeof current === "number") {
          cropper.setAspect(1 / current, {
            event: event.nativeEvent,
            reason: "orientation",
          });
        }
      },
      [cropper]
    );
    return useRender({
      className,
      props: mergeProps(
        {
          "data-orientation": orientation,
          "data-zriz-item": "orientation",
          disabled: typeof aspect !== "number" || aspect === 1,
          onClick,
          type: "button",
        },
        props
      ),
      ref,
      render,
      state: { orientation },
      tag: "button",
    });
  });
