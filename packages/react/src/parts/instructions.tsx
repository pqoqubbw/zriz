"use client";

import { forwardRef, useContext } from "react";

import { RootContext } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

type InstructionsProps = PartProps<"div", object>;

const Instructions: Part<InstructionsProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  InstructionsProps
>(function Instructions(props, ref) {
  const { instructions } = useContext(RootContext);
  const own = { ...props, id: instructions };

  return usePart(
    "div",
    { "data-zriz-item": "instructions", hidden: true },
    own,
    ref,
    {}
  );
});

export type { InstructionsProps };
export { Instructions };
