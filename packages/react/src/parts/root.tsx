"use client";

import { createCropper } from "@zriz/core";
import type { Cropper, CropperSnapshot } from "@zriz/core";
import {
  ZrizError,
  attachImage,
  loadImage,
  setCropShape,
  viewOf,
} from "@zriz/core/dom";
import type { Chrome, LoadedImage } from "@zriz/core/dom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { Ref } from "react";

import { CropperContext } from "../context";
import { attach, mergeRefs } from "../merge-props";
import {
  RootContextValue,
  useElementBox,
  useHold,
  useIsomorphicLayoutEffect,
  useLatest,
} from "../part";
import type { ElementBox, Part, PartProps, RootContext } from "../part";
import { useCropper, useCropperState } from "../use-cropper";
import type { UseCropperOptions } from "../use-cropper";
import { usePart } from "../use-render";

export interface RootState {
  snapshot: CropperSnapshot;
  chrome: Chrome;
}

export interface RootProps
  extends
    UseCropperOptions,
    Omit<PartProps<"div", RootState>, "defaultValue" | "onError" | "onLoad"> {
  /** The photo: a URL, a Blob or File, or null while empty. */
  src?: string | Blob | null | undefined;
  /** CORS mode for a cross-origin URL. */
  crossOrigin?: "anonymous" | "use-credentials" | undefined;
  /** Crop shape. A circle locks the aspect to 1, draws a round mask and exports a round PNG. */
  shape?: "rect" | "circle" | undefined;
  /** "always" keeps full motion, "reduce" forces short motion. @default "auto" */
  motion?: "auto" | "always" | "reduce" | undefined;
  /** Milliseconds the crop waits after a gesture before it recentres. @default 500 */
  recentreDelay?: number | undefined;
  /** Reading direction for keys and sliders. @default "ltr" */
  dir?: "ltr" | "rtl" | undefined;
  /** Locale for value text. */
  locale?: string | undefined;
  /** Receives the imperative API. */
  actionsRef?: Ref<Cropper> | undefined;
  /** Called once the photo is decoded and ready to crop. */
  onLoad?: ((image: LoadedImage) => void) | undefined;
  /** Called with a typed ZrizError when the photo cannot load. */
  onError?: ((error: ZrizError) => void) | undefined;
}

const IDLE: Chrome = {
  active: false,
  grid: "none",
  overscroll: false,
  transition: null,
};

const serverChrome = (): Chrome => IDLE;

const useBoxRef = (
  box: ElementBox,
  theirs: Ref<HTMLDivElement>
): ReturnType<typeof mergeRefs<HTMLDivElement>> =>
  useMemo(
    () =>
      mergeRefs<HTMLDivElement>(
        (node) => (node ? box.set(node) : undefined),
        theirs
      ),
    [box, theirs]
  );

const orientationOf = (aspect: CropperSnapshot["aspect"]): string => {
  if (typeof aspect !== "number" || aspect === 1) {
    return "square";
  }
  return aspect > 1 ? "landscape" : "portrait";
};

export const Root: Part<RootProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  RootProps
>(function Root(
  {
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
    recentreDelay,
    dir = "ltr",
    locale,
    actionsRef,
    onLoad,
    onError,
    ...html
  },
  ref
) {
  const cropper = useCropper({
    aspect: shape === "circle" ? 1 : aspect,
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
  useHold(
    useCallback(() => attach(actionsRef, cropper), [actionsRef, cropper])
  );
  const view = viewOf(cropper);
  useIsomorphicLayoutEffect(() => {
    setCropShape(cropper, shape);
    return shape === "circle"
      ? cropper.retarget({ aspect: 1, lock: true })
      : undefined;
  }, [cropper, shape]);
  useIsomorphicLayoutEffect(() => {
    view.setOptions({ motion, recentreDelay });
  }, [view, motion, recentreDelay]);
  const reducedMotion = useSyncExternalStore(
    view.onChrome,
    view.reducedMotion,
    () => motion === "reduce"
  );
  const snapshot = useCropperState((s) => s, cropper);
  const chrome = useSyncExternalStore(view.onChrome, view.chrome, serverChrome);
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
      let loaded: LoadedImage;
      try {
        loaded = await loadImage(src, {
          crossOrigin,
          signal: controller.signal,
        });
      } catch (error) {
        if (!controller.signal.aborted && error instanceof ZrizError) {
          latestError.current?.(error);
        }
        return;
      }
      if (controller.signal.aborted) {
        const scratch = createCropper();
        attachImage(scratch, loaded);
        attachImage(scratch, null);
        return;
      }
      attachImage(cropper, loaded);
      latestLoad.current?.(loaded);
    };
    void run();
    return () => {
      controller.abort();
    };
  }, [cropper, crossOrigin, latestError, latestLoad, src]);
  const box = useElementBox();
  const merged = useBoxRef(box, ref);
  useEffect(() => {
    const node = box.get();
    return () => {
      if (!external && node?.isConnected !== true) {
        attachImage(cropper, null);
      }
    };
  }, [box, cropper, external]);
  const context = useMemo<RootContext>(
    () => ({ box, dir, instructions, locale, shape }),
    [box, dir, instructions, locale, shape]
  );
  const gesture = snapshot.interacting;
  const part = usePart(
    "div",
    {
      "data-base-ui-swipe-ignore": "",
      "data-changed": snapshot.pristine ? undefined : "",
      "data-disabled": snapshot.disabled ? "" : undefined,
      "data-grid": chrome.grid,
      "data-interacting": chrome.active ? "" : undefined,
      "data-mirrored": snapshot.mirrored ? "" : undefined,
      "data-orientation": orientationOf(snapshot.aspect),
      "data-overscroll": chrome.overscroll ? "" : undefined,
      "data-panning": gesture === "pan" ? "" : undefined,
      "data-pinching": gesture === "pinch" ? "" : undefined,
      "data-reduced-motion": reducedMotion ? "" : undefined,
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
    html,
    merged,
    { chrome, snapshot }
  );
  return (
    <CropperContext.Provider value={cropper}>
      <RootContextValue.Provider value={context}>
        {part}
      </RootContextValue.Provider>
    </CropperContext.Provider>
  );
});
