"use client";

import type { Cropper, CropperSnapshot } from "@zriz/core";
import { viewOf } from "@zriz/core/dom";
import type { Chrome } from "@zriz/core/dom";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactElement, Ref } from "react";

import { CropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue } from "../part";
import type { PartProps, RootContext } from "../part";
import { useCropper, useCropperState } from "../use-cropper";
import type { UseCropperOptions } from "../use-cropper";
import { useRender } from "../use-render";

export interface RootState {
  snapshot: CropperSnapshot;
  chrome: Chrome;
}

export interface RootProps
  extends UseCropperOptions, Omit<PartProps<"div", RootState>, "defaultValue"> {
  /** The photo: a URL, a Blob or File, or null while empty. */
  src?: string | Blob | null;
  /** CORS mode for a cross-origin URL. */
  crossOrigin?: "anonymous" | "use-credentials";
  /** Crop shape. A circle draws a round mask and exports a round PNG. */
  shape?: "rect" | "circle";
  /** "always" keeps full motion, "reduce" forces short motion. @default "auto" */
  motion?: "auto" | "always" | "reduce";
  /** Reading direction for keys and sliders. @default "ltr" */
  dir?: "ltr" | "rtl";
  /** Locale for value text. */
  locale?: string;
  /** Receives the imperative API. */
  actionsRef?: Ref<Cropper>;
}

const blobUrls = new Map<Blob, { url: string; count: number }>();

const releaseLater = (blob: Blob, delay: number): void => {
  setTimeout(() => {
    const entry = blobUrls.get(blob);
    if (entry && entry.count === 0) {
      URL.revokeObjectURL(entry.url);
      blobUrls.delete(blob);
    }
  }, delay);
};

const urlFor = (blob: Blob): string => {
  const entry = blobUrls.get(blob);
  if (entry) {
    return entry.url;
  }
  const url = URL.createObjectURL(blob);
  blobUrls.set(blob, { count: 0, url });
  releaseLater(blob, 5000);
  return url;
};

const orientationOf = (aspect: CropperSnapshot["aspect"]): string => {
  if (typeof aspect !== "number" || aspect === 1) {
    return "square";
  }
  return aspect > 1 ? "landscape" : "portrait";
};

const useObjectUrl = (src: string | Blob | null | undefined): string | null => {
  useEffect(() => {
    const entry = src instanceof Blob ? blobUrls.get(src) : undefined;
    if (entry) {
      entry.count += 1;
    }
    return () => {
      if (entry && src instanceof Blob) {
        entry.count -= 1;
        releaseLater(src, 0);
      }
    };
  }, [src]);
  if (src instanceof Blob) {
    return urlFor(src);
  }
  return src ?? null;
};

export const Root = ({
  cropper: external,
  image,
  value,
  aspect,
  rotation,
  zoom,
  defaultValue,
  minSize,
  maxZoom,
  focalLength,
  disabled,
  onValueChange,
  onValueCommit,
  plugins,
  src,
  crossOrigin,
  shape = "rect",
  motion = "auto",
  dir = "ltr",
  locale,
  actionsRef,
  render,
  className,
  ref,
  ...html
}: RootProps): ReactElement => {
  const cropper = useCropper({
    aspect,
    cropper: external,
    defaultValue,
    disabled,
    focalLength,
    image,
    maxZoom,
    minSize,
    onValueChange,
    onValueCommit,
    plugins,
    rotation,
    value,
    zoom,
  });
  useImperativeHandle(actionsRef, () => cropper, [cropper]);
  const view = viewOf(cropper);
  useEffect(() => {
    view.setOptions({ motion });
  }, [view, motion]);
  const snapshot = useCropperState((s) => s, cropper);
  const chrome = useSyncExternalStore(view.onChrome, view.chrome, view.chrome);
  const instructions = useId();
  const url = useObjectUrl(src);
  const context = useMemo<RootContext>(
    () => ({ crossOrigin, dir, instructions, locale, shape, src: url }),
    [crossOrigin, dir, instructions, locale, shape, url]
  );
  const gesture = snapshot.interacting;
  const element = useRender({
    className,
    props: mergeProps(
      {
        "data-changed": snapshot.pristine ? undefined : "",
        "data-disabled": snapshot.disabled ? "" : undefined,
        "data-grid": chrome.grid,
        "data-interacting": chrome.active ? "" : undefined,
        "data-mirrored": snapshot.mirrored ? "" : undefined,
        "data-orientation": orientationOf(snapshot.aspect),
        "data-overscroll": chrome.overscroll ? "" : undefined,
        "data-panning": gesture === "pan" ? "" : undefined,
        "data-pinching": gesture === "pinch" ? "" : undefined,
        "data-reduced-motion": view.reducedMotion() ? "" : undefined,
        "data-resizing": gesture === "resize" ? "" : undefined,
        "data-rotating": gesture === "dial" ? "" : undefined,
        "data-settling": snapshot.settling ? "" : undefined,
        "data-shape": shape,
        "data-transition": chrome.transition ?? undefined,
        "data-zooming":
          gesture === "wheel" || gesture === "zoom-control" ? "" : undefined,
        "data-zriz-item": "root",
        dir,
      },
      html
    ),
    ref,
    render,
    state: { chrome, snapshot },
    tag: "div",
  });
  return (
    <CropperContext value={cropper}>
      <RootContextValue value={context}>{element}</RootContextValue>
    </CropperContext>
  );
};
