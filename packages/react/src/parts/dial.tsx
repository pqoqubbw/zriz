"use client";

import { dialAria, dialHandlers, dialState } from "@zriz/core/dom";
import { warnFormat, warnUnlabelled } from "@zriz/react/warn";
import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { useCropperContext } from "../context";
import {
  RootContext,
  keepStyle,
  nativeProps,
  useElementBox,
  useMergedRef,
  useRelease,
  useSameJson,
} from "../part";
import type { Part, PartProps } from "../part";
import { firstCommitted, useAriaDisabled } from "../use-cropper";
import { usePart } from "../use-render";

type DialState = {
  dragging: boolean;
};

type DialProps = PartProps<"div", DialState> & {
  /** Formatting of the spoken value. aria-valuetext wins over it. @default degrees, long unit */
  format?: Intl.NumberFormatOptions | undefined;
};

const STYLE = {
  WebkitTapHighlightColor: "transparent",
  WebkitUserSelect: "none",
  position: "relative",
  touchAction: "pan-y",
  userSelect: "none",
} as const;

const keep = keepStyle(STYLE);

const Dial: Part<DialProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  DialProps
>(function Dial({ format, ...props }, ref) {
  const cropper = useCropperContext();
  const { dir, locale } = useContext(RootContext);
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
  const disabled = useAriaDisabled();
  const [first] = useState(() => firstCommitted(cropper).rotation);
  const spoken = useSameJson(format);
  const ownText = props["aria-valuetext"] !== undefined;
  const own = useCallback(
    (node: HTMLDivElement) => {
      keep(node);
      const clear = box.set(node);

      warnUnlabelled("Dial", node);
      warnFormat("Dial", locale, spoken);
      const off = dialAria(cropper, node, { format: spoken, locale, ownText });

      return () => {
        clear();
        off();
      };
    },
    [box, cropper, spoken, locale, ownText]
  );

  return usePart(
    "div",
    {
      "aria-disabled": disabled,
      "aria-orientation": "horizontal",
      "aria-valuenow": Math.round(first * 10) / 10 || 0,
      "data-dragging": dragging ? "" : undefined,
      "data-snapped": first === 0 ? "" : undefined,
      "data-zriz-item": "dial",
      ...nativeProps(handlers),
      role: "slider",
      style: STYLE,
      tabIndex: 0,
    },
    props,
    useMergedRef(own, ref),
    { dragging }
  );
});

export type { DialProps, DialState };
export { Dial };
