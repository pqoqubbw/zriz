"use client";

import type { Cropper, CropperSnapshot } from "@zriz/core";
import { ZrizError, attachImage, loadImage, viewOf } from "@zriz/core/dom";
import type { Chrome, LoadedImage } from "@zriz/core/dom";
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
import { RootContextValue, useLatest } from "../part";
import type { PartProps, RootContext } from "../part";
import { useCropper, useCropperState } from "../use-cropper";
import type { UseCropperOptions } from "../use-cropper";
import { useRender } from "../use-render";

export interface RootState {
  snapshot: CropperSnapshot;
  chrome: Chrome;
}

export interface RootProps
  extends
    UseCropperOptions,
    Omit<PartProps<"div", RootState>, "defaultValue" | "onError" | "onLoad"> {
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
  /** Called once the photo is decoded and ready to crop. */
  onLoad?: (image: LoadedImage) => void;
  /** Called with a typed ZrizError when the photo cannot load. */
  onError?: (error: ZrizError) => void;
}

const orientationOf = (aspect: CropperSnapshot["aspect"]): string => {
  if (typeof aspect !== "number" || aspect === 1) {
    return "square";
  }
  return aspect > 1 ? "landscape" : "portrait";
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
  onLoad,
  onError,
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
  const latestLoad = useLatest(onLoad);
  const latestError = useLatest(onError);
  useEffect(() => {
    const controller = new AbortController();
    const run = async (): Promise<void> => {
      if (src === undefined) {
        return;
      }
      if (src === null) {
        attachImage(cropper, null);
        return;
      }
      try {
        const loaded = await loadImage(src, {
          crossOrigin,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          loaded.preview.close();
          return;
        }
        attachImage(cropper, loaded);
        latestLoad.current?.(loaded);
      } catch (error) {
        if (!controller.signal.aborted && error instanceof ZrizError) {
          latestError.current?.(error);
        }
      }
    };
    void run();
    return () => {
      controller.abort();
    };
  }, [cropper, crossOrigin, latestError, latestLoad, src]);
  const context = useMemo<RootContext>(
    () => ({ crossOrigin, dir, instructions, locale, shape, src: null }),
    [crossOrigin, dir, instructions, locale, shape]
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
