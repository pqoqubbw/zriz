"use client";

import { forwardRef, useContext } from "react";

import { RootContextValue } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export type InstructionsProps = PartProps<"div", object>;

export const Instructions: Part<InstructionsProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  InstructionsProps
>(function Instructions(props, ref) {
  const { instructions } = useContext(RootContextValue);
  const own = { ...props, id: instructions };
  return usePart(
    "div",
    { "data-zriz-item": "instructions", hidden: true },
    own,
    ref,
    {}
  );
});
