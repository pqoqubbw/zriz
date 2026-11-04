"use client";

import { bindPhoto } from "@zriz/core/dom";
import { forwardRef, useCallback } from "react";

import { useCropperContext } from "../context";
import { useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

export type ImageState = {
  ready: boolean;
};

export type ImageProps = {
  /** Text for the photo. Empty when the crop is described elsewhere. @default "" */
  alt?: string | undefined;
} & PartProps<"div", ImageState>;

export const Image: Part<ImageProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  ImageProps
>(function Image({ alt = "", ...props }, ref) {
  const cropper = useCropperContext();
  const ready = useCropperState((s) => s.ready);
  const own = useCallback(
    (element: HTMLDivElement) => bindPhoto(cropper, element),
    [cropper]
  );

  return usePart(
    "div",
    {
      "aria-label": alt === "" ? undefined : alt,
      children: [
        <img alt="" draggable={false} key="motion" />,
        <canvas aria-hidden key="rest" />,
      ],
      "data-ready": ready ? "" : undefined,
      "data-zriz-item": "image",
      role: alt === "" ? undefined : "img",
    },
    props,
    useMergedRef(own, ref),
    { ready }
  );
});
