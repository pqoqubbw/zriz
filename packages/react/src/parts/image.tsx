"use client";

import { bindPhoto } from "@zriz/core/dom";
import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface ImageState {
  ready: boolean;
}

export interface ImageProps extends PartProps<"div", ImageState> {
  /** Text for the photo. Empty when the crop is described elsewhere. @default "" */
  alt?: string;
}

export const Image: Part<ImageProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ImageProps
>(function Image({ alt = "", render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const ready = useCropperState((s) => s.ready);
  const own = useCallback(
    (element: HTMLDivElement) => bindPhoto(cropper, element),
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
});
