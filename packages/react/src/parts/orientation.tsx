"use client";

import { orientationOf } from "@zriz/core/dom";
import { forwardRef } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import type { Part, PartProps } from "../part";
import { useAriaDisabled, useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export type OrientationState = {
  orientation: "portrait" | "landscape" | "square";
};

export type OrientationProps = PartProps<"button", OrientationState>;

export const Orientation: Part<OrientationProps, HTMLButtonElement> =
  forwardRef<HTMLButtonElement, OrientationProps>(
    function Orientation(props, ref) {
      const cropper = useCropperContext();
      const aspect = useCropperState((s) => s.aspect);
      const orientation = orientationOf(aspect);
      const disabled = orientation === "square";

      const onClick = (event: MouseEvent): void => {
        const current = cropper.getValue().aspect;

        if (typeof current === "number") {
          cropper.setAspect(1 / current, {
            event: event.nativeEvent,
            reason: "orientation",
          });
        }
      };

      return usePart(
        "button",
        {
          "aria-disabled": useAriaDisabled(),
          "data-disabled": disabled ? "" : undefined,
          "data-orientation": orientation,
          "data-zriz-item": "orientation",
          disabled,
          onClick,
          type: "button",
        },
        props,
        ref,
        { orientation }
      );
    }
  );
