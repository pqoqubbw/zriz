import { ZrizError } from "./error";
import type { LoadedImage, outputLimit, toZriz } from "./image";
import type {
  decodeTurn,
  gate,
  lane,
  motionOff,
  regionOff,
  resampleOff,
  via,
} from "./worker";

type Tools = {
  decodeTurn: typeof decodeTurn;
  gate: typeof gate;
  lane: typeof lane;
  motionOff: typeof motionOff;
  outputLimit: typeof outputLimit;
  regionOff: typeof regionOff;
  resampleOff: typeof resampleOff;
  toZriz: typeof toZriz;
  via: typeof via;
};

const borrowed: WeakSet<object> = new WeakSet<object>();

const releases = new WeakMap<LoadedImage, () => void>();

let tools: Tools | undefined;

const setTools = (value: Tools): void => {
  tools = value;
};

const toolsOf = (): Tools => {
  if (tools === undefined) {
    throw new ZrizError("no-image", "zriz: load an image first");
  }

  return tools;
};

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

export type { Tools };
export { borrowed, freeImage, onFree, setTools, toolsOf };
