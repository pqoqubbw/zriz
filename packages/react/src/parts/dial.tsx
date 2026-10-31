"use client";

import { dialAria, dialHandlers, dialState } from "@zriz/core/dom";
import { warnUnlabelled } from "@zriz/react/warn";
import {
  forwardRef,
  useContext,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, native, useElementBox, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

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
>(function Dial({ format, render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const { dir, locale } = useContext(RootContextValue);
  const box = useElementBox();
  const [handlers] = useState(() => dialHandlers(cropper, { dir }, box.get));
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
      box.set(node);
      warnUnlabelled("Dial", node);
      const off = dialAria(cropper, node, { format, locale });
      return () => {
        box.set(null);
        off();
      };
    },
    [box, cropper, format, locale]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-orientation": "horizontal",
        "data-dragging": dragging ? "" : undefined,
        "data-zriz-item": "dial",
        onBlur: native(handlers.onBlur),
        onKeyDown: native(handlers.onKeyDown),
        onKeyUp: native(handlers.onKeyUp),
        onLostPointerCapture: native(handlers.onLostPointerCapture),
        onPointerCancel: native(handlers.onPointerCancel),
        onPointerDown: native(handlers.onPointerDown),
        onPointerMove: native(handlers.onPointerMove),
        onPointerUp: native(handlers.onPointerUp),
        role: "slider",
        style: {
          WebkitTapHighlightColor: "transparent",
          position: "relative",
          touchAction: "pan-y",
          userSelect: "none",
        },
        tabIndex: 0,
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { dragging },
    tag: "div",
  });
});
