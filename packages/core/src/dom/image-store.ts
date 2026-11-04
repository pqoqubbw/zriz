import type { Cropper } from "../cropper";
import { ZrizError } from "./error";
import { freeImage } from "./image";
import type { LoadedImage } from "./image";
import { afterPaint } from "./later";

const attached = new WeakMap<Cropper, LoadedImage>();

const holders = new WeakMap<LoadedImage, number>();

const freed = new WeakSet<LoadedImage>();

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
  if (image && freed.has(image)) {
    throw new ZrizError(
      "no-image",
      "zriz: this image was freed when it left its last cropper. Load it again."
    );
  }
  const previous = attached.get(cropper);
  if (image && image !== previous) {
    holders.set(image, (holders.get(image) ?? 0) + 1);
  }
  if (previous && previous !== image) {
    const left = (holders.get(previous) ?? 1) - 1;
    holders.set(previous, left);
    if (left === 0) {
      freed.add(previous);
      freeImage(previous);
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
