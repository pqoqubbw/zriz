import type { LoadedImage } from "./image";

const borrowed: WeakSet<object> = new WeakSet<object>();

const releases = new WeakMap<LoadedImage, () => void>();

const closeOwn = (bitmap: ImageBitmap): void => {
  if (!borrowed.has(bitmap)) {
    bitmap.close();
  }
};

const onFree = (image: LoadedImage, release: () => void): void => {
  releases.set(image, release);
};

const freeImage = (image: LoadedImage): void => {
  releases.get(image)?.();
  closeOwn(image.preview);

  if (image.source instanceof ImageBitmap && image.source !== image.preview) {
    closeOwn(image.source);
  }
};

export { borrowed, freeImage, onFree };
