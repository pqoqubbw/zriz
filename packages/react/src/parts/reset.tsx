"use client";

import { forwardRef, useContext } from "react";
import type { MouseEvent } from "react";

import { useCropperContext } from "../context";
import {
  RootContext,
  useElementBox,
  useIsomorphicLayoutEffect,
  useMergedRef,
} from "../part";
import type { Part, PartProps } from "../part";
import { useAriaDisabled, useCropperState } from "../use-cropper";
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
  const disabled = useAriaDisabled();
  const { box: root } = useContext(RootContext);
  const box = useElementBox();
  const focused = box.get()?.matches(":focus") === true;
  useIsomorphicLayoutEffect(() => {
    if (pristine && focused && box.get()?.matches("[hidden]") === true) {
      const scope = root?.get();
      for (const selector of [
        '[data-zriz-item="area"]',
        '[tabindex="0"]:not([hidden]),button:enabled:not([hidden])',
      ]) {
        for (const next of scope?.querySelectorAll<HTMLElement>(selector) ??
          []) {
          next.focus({ preventScroll: true });
          if (next.matches(":focus")) {
            return;
          }
        }
      }
    }
  }, [box, focused, pristine, root]);
  const onClick = (event: MouseEvent): void => {
    cropper.reset({ event: event.nativeEvent });
  };
  return usePart(
    "button",
    {
      "aria-disabled": disabled,
      "data-pristine": pristine ? "" : undefined,
      "data-zriz-item": "reset",
      hidden: pristine,
      onClick,
      type: "button",
    },
    props,
    useMergedRef<HTMLButtonElement>(box.set, ref),
    { pristine }
  );
});
