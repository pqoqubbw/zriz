"use client";

import { bindImage } from "@zriz/core/dom";
import { use, useCallback } from "react";
import type { ReactElement, SyntheticEvent } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, useMergedRef } from "../part";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface ImageState {
  ready: boolean;
}

export type ImageProps = PartProps<"img", ImageState>;

export const Image = ({
  render,
  className,
  ref,
  ...props
}: ImageProps): ReactElement => {
  const cropper = useCropperContext();
  const { src, crossOrigin } = use(RootContextValue);
  const ready = useCropperState((s) => s.ready);
  const own = useCallback(
    (element: HTMLImageElement | null) =>
      element ? bindImage(cropper, element) : undefined,
    [cropper]
  );
  const onLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget;
      cropper.setImage({ height: naturalHeight, width: naturalWidth });
    },
    [cropper]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        alt: "",
        crossOrigin,
        "data-ready": ready ? "" : undefined,
        "data-zriz-item": "image",
        decoding: "async",
        draggable: false,
        onLoad,
        src: src ?? undefined,
      },
      props
    ),
    ref: useMergedRef(own, ref),
    render,
    state: { ready },
    tag: "img",
  });
};
