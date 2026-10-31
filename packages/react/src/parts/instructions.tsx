"use client";

import { forwardRef, useContext } from "react";

import { mergeProps } from "../merge-props";
import { RootContextValue } from "../part";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

export type InstructionsProps = PartProps<"div", object>;

export const Instructions: Part<InstructionsProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  InstructionsProps
>(function Instructions({ render, className, ...props }, ref) {
  const { instructions } = useContext(RootContextValue);
  return useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "instructions", hidden: true, id: instructions },
      props
    ),
    ref,
    render,
    state: {},
    tag: "div",
  });
});
