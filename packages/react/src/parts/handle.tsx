"use client";

import { handleHandlers } from "@zriz/core/dom";
import type { HandleEdge } from "@zriz/core/dom";
import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { native, useElementBox, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

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

export const Handle = ({
  position,
  render,
  className,
  ref,
  ...props
}: HandleProps): ReactElement => {
  const cropper = useCropperContext();
  const box = useElementBox();
  const handlers = useMemo(
    () => handleHandlers(cropper, position, box.get),
    [box, cropper, position]
  );
  const active = useCropperState((s) => s.interacting === "resize");
  const own = useCallback(
    (node: HTMLDivElement | null) => {
      box.set(node);
      return () => {
        box.set(null);
      };
    },
    [box]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-hidden": true,
        "data-edge": position,
        "data-zriz-item": "handle",
        onLostPointerCapture: native(handlers.onLostPointerCapture),
        onPointerCancel: native(handlers.onPointerCancel),
        onPointerDown: native(handlers.onPointerDown),
        onPointerMove: native(handlers.onPointerMove),
        onPointerUp: native(handlers.onPointerUp),
        style: placement(position),
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { active, position },
    tag: "div",
  });
};
