"use client";

import { bindPhoto } from "@zriz/core/dom";
import { useCallback } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface ImageState {
  ready: boolean;
}

export interface ImageProps extends PartProps<"div", ImageState> {
  /** Text for the photo. Empty when the crop is described elsewhere. @default "" */
  alt?: string;
}

export const Image = ({
  alt = "",
  render,
  className,
  ref,
  ...props
}: ImageProps): ReactElement => {
  const cropper = useCropperContext();
  const ready = useCropperState((s) => s.ready);
  const own = useCallback(
    (element: HTMLDivElement | null) =>
      element ? bindPhoto(cropper, element) : undefined,
    [cropper]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        children: [
          <img alt={alt} draggable={false} key="motion" />,
          <canvas aria-hidden key="rest" />,
        ],
        "data-ready": ready ? "" : undefined,
        "data-zriz-item": "image",
        role: alt === "" ? undefined : "img",
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { ready },
    tag: "div",
  });
};
