"use client";

import { dialAria, dialHandlers, dialState } from "@zriz/core/dom";
import { warnUnlabelled } from "@zriz/react/warn";
import {
  forwardRef,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { useCropperContext } from "../context";
import {
  RootContextValue,
  nativeProps,
  useElementBox,
  useMergedRef,
  useRelease,
} from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface DialState {
  dragging: boolean;
}

export interface DialProps extends PartProps<"div", DialState> {
  /** Formatting of the spoken value. @default degrees, long unit */
  format?: Intl.NumberFormatOptions;
}

export const Dial: Part<DialProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  DialProps
>(function Dial({ format, ...props }, ref) {
  const cropper = useCropperContext();
  const { dir, locale } = useContext(RootContextValue);
  const box = useElementBox();
  const handlers = useMemo(
    () => dialHandlers(cropper, { dir }, box.get),
    [box, cropper, dir]
  );
  useRelease(handlers);
  const state = dialState(cropper);
  useEffect(() => {
    state.setOptions({ ...state.options(), dir });
  }, [state, dir]);
  const dragging = useSyncExternalStore(
    state.onChange,
    state.dragging,
    () => false
  );
  const own = useCallback(
    (node: HTMLDivElement) => {
      const clear = box.set(node);
      warnUnlabelled("Dial", node);
      const off = dialAria(cropper, node, { format, locale });
      return () => {
        clear();
        off();
      };
    },
    [box, cropper, format, locale]
  );
  return usePart(
    "div",
    {
      "aria-orientation": "horizontal",
      "data-dragging": dragging ? "" : undefined,
      "data-zriz-item": "dial",
      ...nativeProps(handlers),
      role: "slider",
      style: {
        WebkitTapHighlightColor: "transparent",
        position: "relative",
        touchAction: "pan-y",
        userSelect: "none",
      },
      tabIndex: 0,
    },
    props,
    useMergedRef(own, ref),
    { dragging }
  );
});
