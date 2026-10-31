import type { Cropper } from "../cropper";
import type { LoadedImage } from "./image";
import { afterPaint } from "./later";
import { releaseOff } from "./worker";

const attached = new WeakMap<Cropper, LoadedImage>();

const imageListeners = new WeakMap<Cropper, Set<() => void>>();

let prefetched = false;

export const onImage = (
  cropper: Cropper,
  listener: () => void
): (() => void) => {
  const set = imageListeners.get(cropper) ?? new Set<() => void>();
  imageListeners.set(cropper, set);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
};

export const attachImage = (
  cropper: Cropper,
  image: LoadedImage | null
): void => {
  const previous = attached.get(cropper);
  if (previous && previous !== image) {
    void releaseOff(previous.id);
    previous.preview.close();
    if (
      previous.source instanceof ImageBitmap &&
      previous.source !== previous.preview
    ) {
      previous.source.close();
    }
  }
  if (image) {
    attached.set(cropper, image);
    cropper.setImage({ height: image.height, width: image.width });
  } else {
    attached.delete(cropper);
    cropper.setImage(null);
  }
  for (const listener of imageListeners.get(cropper) ?? []) {
    listener();
  }
  if (image && !prefetched) {
    prefetched = true;
    afterPaint(async () => await import("./render"));
  }
};

export const imageOf = (cropper: Cropper): LoadedImage | null =>
  attached.get(cropper) ?? null;
