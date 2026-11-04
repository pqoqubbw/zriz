"use client";

import { createCropper } from "@zriz/core";
import type { Cropper, CropperSnapshot } from "@zriz/core";
import {
  ZrizError,
  attachImage,
  loadImage,
  setCropShape,
  stateAttributes,
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
import type { Ref, RefCallback } from "react";

import { CropperContext } from "../context";
import { attach, mergeRefs } from "../merge-props";
import {
  RootContext,
  useElementBox,
  useHold,
  useIsomorphicLayoutEffect,
  useLatest,
} from "../part";
import type { ElementBox, Part, PartProps, RootContextValue } from "../part";
import { useCropper, useCropperState } from "../use-cropper";
import type { UseCropperOptions } from "../use-cropper";
import { usePart } from "../use-render";

type RootState = {
  snapshot: CropperSnapshot;
  chrome: Chrome;
};

type RootProps = UseCropperOptions &
  Omit<PartProps<"div", RootState>, "defaultValue" | "onError" | "onLoad"> & {
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
  };

const IDLE: Chrome = {
  active: false,
  grid: "none",
  overscroll: false,
  transition: null,
};

const actionHolders = new WeakMap<object, () => unknown>();

const holdActions = (
  ref: Ref<Cropper> | undefined,
  cropper: Cropper
): (() => unknown) | null => {
  if (!ref) {
    return null;
  }

  let cleanup: ReturnType<RefCallback<Cropper>>;

  const release = (): void => {
    if (typeof cleanup === "function") {
      cleanup();
    } else if (actionHolders.get(ref) === release) {
      attach(ref, null);
    }
  };

  actionHolders.set(ref, release);

  if (typeof ref === "function") {
    cleanup = ref(cropper);
  } else {
    ref.current = cropper;
  }

  return release;
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

const Root: Part<RootProps, HTMLDivElement> = forwardRef<
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
    useCallback(() => holdActions(actionsRef, cropper), [actionsRef, cropper])
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

  const current = useLatest(cropper);

  useEffect(() => {
    const node = box.get();

    return () => {
      if (
        !external &&
        (node?.isConnected !== true || current.current !== cropper)
      ) {
        attachImage(cropper, null);
      }
    };
  }, [box, cropper, current, external]);

  const context = useMemo<RootContextValue>(
    () => ({ box, dir, instructions, locale, shape }),
    [box, dir, instructions, locale, shape]
  );
  const part = usePart(
    "div",
    {
      "data-base-ui-swipe-ignore": "",
      "data-shape": shape,
      "data-vaul-no-drag": "",
      "data-zriz-item": "root",
      ...stateAttributes(snapshot, chrome, reducedMotion),
      dir,
    },
    html,
    merged,
    { chrome, snapshot }
  );

  return (
    <CropperContext.Provider value={cropper}>
      <RootContext.Provider value={context}>{part}</RootContext.Provider>
    </CropperContext.Provider>
  );
});

export type { RootProps, RootState };
export { Root };
