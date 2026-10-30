"use client";

import { areaKeyHandlers, bindArea } from "@zriz/core/dom";
import { use, useCallback, useState } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, native, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";
import { warnUnlabelled } from "../warn";

export interface AreaState {
  shape: "rect" | "circle";
  interacting: boolean;
}

export type AreaProps = PartProps<"div", AreaState>;

export const Area = ({
  render,
  className,
  ref,
  ...props
}: AreaProps): ReactElement => {
  const cropper = useCropperContext();
  const { shape, instructions } = use(RootContextValue);
  const interacting = useCropperState((s) => s.interacting !== null);
  const [keys] = useState(() => areaKeyHandlers(cropper));
  const own = useCallback(
    (element: HTMLDivElement | null) => {
      warnUnlabelled("Area", element);
      return element ? bindArea(cropper, element) : undefined;
    },
    [cropper]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-describedby": instructions,
        "data-interacting": interacting ? "" : undefined,
        "data-shape": shape,
        "data-zriz-item": "area",
        onKeyDown: native(keys.onKeyDown),
        onKeyUp: native(keys.onKeyUp),
        role: "group",
        tabIndex: 0,
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { interacting, shape },
    tag: "div",
  });
};
