"use client";

import type { Aspect } from "@zriz/core";
import { forwardRef } from "react";

import { AspectGroupContext } from "../buttons-context";
import { mergeProps } from "../merge-props";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface AspectGroupState {
  aspect: Aspect;
}

export type AspectGroupProps = PartProps<"div", AspectGroupState>;

export const AspectGroup: Part<AspectGroupProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  AspectGroupProps
>(function AspectGroup({ render, className, ...props }, ref) {
  const aspect = useCropperState((s) => s.aspect);
  const element = useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "aspect-group", role: "radiogroup" },
      props
    ),
    ref,
    render,
    state: { aspect },
    tag: "div",
  });
  return (
    <AspectGroupContext.Provider value>{element}</AspectGroupContext.Provider>
  );
});
