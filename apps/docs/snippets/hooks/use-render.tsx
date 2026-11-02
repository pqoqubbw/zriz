"use client";

import { useCropperState, useRender } from "@zriz/react";
import type { ClassName, RenderProp } from "@zriz/react";

interface EditedState {
  pristine: boolean;
}

interface EditedProps {
  render?: RenderProp<EditedState>;
  className?: ClassName<EditedState>;
}

export const Edited = ({ render, className }: EditedProps) => {
  const pristine = useCropperState((s) => s.pristine);
  return useRender({
    tag: "span",
    state: { pristine },
    render,
    className,
    props: { children: pristine ? "original" : "edited" },
  });
};
