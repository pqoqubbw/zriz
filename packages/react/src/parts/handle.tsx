"use client";

import { handleHandlers, viewOf } from "@zriz/core/dom";
import type { HandleEdge } from "@zriz/core/dom";
import { forwardRef, useCallback, useMemo, useState } from "react";

import { useCropperContext } from "../context";
import {
  keepStyle,
  nativeProps,
  useElementBox,
  useLatest,
  useMergedRef,
  useRelease,
} from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export interface HandleState {
  position: HandleEdge;
  active: boolean;
}

export interface HandleProps extends PartProps<"div", HandleState> {
  /** Which corner or edge this handle drags. */
  position: HandleEdge;
}

const placement = (position: HandleEdge): React.CSSProperties => {
  const size = "var(--zriz-handle-size, 44px)";
  const style: React.CSSProperties = {
    WebkitTapHighlightColor: "transparent",
    height: size,
    position: "absolute",
    touchAction: "none",
    width: size,
  };
  let tx = "-50%";
  let ty = "-50%";
  if (position.endsWith("left")) {
    style.left = 0;
  } else if (position.endsWith("right")) {
    style.right = 0;
    tx = "50%";
  } else {
    style.left = "50%";
  }
  if (position.startsWith("top")) {
    style.top = 0;
  } else if (position.startsWith("bottom")) {
    style.bottom = 0;
    ty = "50%";
  } else {
    style.top = "50%";
  }
  style.translate = `${tx} ${ty}`;
  return style;
};

const restore = (node: HTMLElement, edge: { readonly current: HandleEdge }) => {
  keepStyle(placement(edge.current))(node);
};

export const Handle: Part<HandleProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  HandleProps
>(function Handle({ position, ...props }, ref) {
  const cropper = useCropperContext();
  const box = useElementBox();
  const edge = useLatest(position);
  const handlers = useMemo(
    () => handleHandlers(cropper, () => edge.current, box.get),
    [box, cropper, edge]
  );
  useRelease(handlers);
  const own = useCallback(
    (node: HTMLDivElement) => {
      restore(node, edge);
      return box.set(node);
    },
    [box, edge]
  );
  const [mine, setMine] = useState(false);
  const active = useCropperState((s) => mine && s.interacting === "resize");
  if (mine && !active) {
    setMine(false);
  }
  const onPointerDown = (event: React.PointerEvent): void => {
    const free = cropper.getState().interacting === null;
    handlers.onPointerDown(event.nativeEvent);
    if (free) {
      setMine(cropper.getState().interacting === "resize");
    }
  };
  return usePart(
    "div",
    {
      "aria-hidden": true,
      "data-active": active ? "" : undefined,
      "data-edge": position,
      "data-zriz-item": "handle",
      ...nativeProps(handlers),
      onPointerDown,
      onPointerDownCapture: (event: React.PointerEvent): void => {
        viewOf(cropper).claim(event.nativeEvent);
      },
      style: placement(position),
    },
    props,
    useMergedRef(own, ref),
    { active, position }
  );
});
