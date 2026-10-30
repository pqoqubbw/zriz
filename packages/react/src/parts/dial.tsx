"use client";

import { dialAria, dialHandlers, dialState } from "@zriz/core/dom";
import {
  use,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, native, useElementBox, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useRender } from "../use-render";
import { warnUnlabelled } from "../warn";

export interface DialState {
  dragging: boolean;
}

export interface DialProps extends PartProps<"div", DialState> {
  /** Formatting of the spoken value. @default degrees, long unit */
  format?: Intl.NumberFormatOptions;
}

export const Dial = ({
  format,
  render,
  className,
  ref,
  ...props
}: DialProps): ReactElement => {
  const cropper = useCropperContext();
  const { dir, locale } = use(RootContextValue);
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
    (node: HTMLDivElement | null) => {
      box.set(node);
      warnUnlabelled("Dial", node);
      const off = node
        ? dialAria(cropper, node, { format, locale })
        : undefined;
      return () => {
        box.set(null);
        off?.();
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
};
