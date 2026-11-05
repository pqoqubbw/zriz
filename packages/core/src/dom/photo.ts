import type { Cropper } from "../cropper";
import type { Matrix3 } from "../geometry/types";
import type { LoadedImage } from "./image";
import { imageOf, onImage } from "./image-store";
import { windowOf } from "./input";
import type { Region } from "./kernel";
import { afterPaint } from "./later";
import { cropShapeOf } from "./shape";
import { TIMEOUT_MS, noop, withTimeout } from "./turn";
import { LAYER_BOX, clipPath, cssMatrix, isAffine, viewOf } from "./view";
import type { Layout, ViewFrame } from "./view";
import { motionOff } from "./worker";

type Drawn = {
  matrix: Matrix3;
  layout: Layout;
};

type MotionFile = {
  url: Promise<string>;
  users: number;
};

const files = new WeakMap<LoadedImage, MotionFile>();
const MATRIX_TOLERANCE = 1e-6;
const LAYOUT_IDLE_MS = 120;

const sameMatrix = (a: Matrix3, b: Matrix3): boolean =>
  a.every((value, i) => Math.abs(value - (b[i] ?? 0)) < MATRIX_TOLERANCE);

const sameBox = (a: Layout, b: Layout): boolean =>
  a.width === b.width && a.height === b.height && a.dpr === b.dpr;

const motionType = (image: LoadedImage): string =>
  image.mime === "image/jpeg" ? "image/jpeg" : "image/png";

const whole = (image: LoadedImage): Region => ({
  height: image.height,
  width: image.width,
  x: 0,
  y: 0,
});

const takeFile = async (image: LoadedImage): Promise<string> => {
  const file = files.get(image) ?? {
    url: motionOff(image.id, motionType(image)).then((blob) =>
      URL.createObjectURL(blob)
    ),
    users: 0,
  };

  file.users += 1;
  files.set(image, file);

  return await file.url;
};

const dropFile = (image: LoadedImage): void => {
  const file = files.get(image);

  if (file) {
    file.users -= 1;

    if (file.users === 0) {
      files.delete(image);
      file.url.then(URL.revokeObjectURL.bind(URL)).catch(noop);
    }
  }
};

const childOf = <K extends "img" | "canvas">(
  container: HTMLElement,
  tag: K
): HTMLElementTagNameMap[K] => {
  const found = container.querySelector(tag);

  if (found) {
    return found;
  }

  const made = container.ownerDocument.createElement(tag);

  container.append(made);

  return made;
};

const bindPhoto = (cropper: Cropper, container: HTMLElement): (() => void) => {
  const view = viewOf(cropper);
  const motion = childOf(container, "img");
  const rest = childOf(container, "canvas");

  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "hidden";
  rest.setAttribute("aria-hidden", "true");
  motion.alt = "";
  motion.draggable = false;
  motion.decoding = "async";
  const layer = { ...LAYER_BOX, transition: "none", visibility: "hidden" };

  Object.assign(rest.style, layer);
  Object.assign(motion.style, layer, { transformOrigin: "0 0" });
  let image: LoadedImage | null = null;
  let motionReady = false;
  let drawn: Drawn | null = null;
  let token = 0;
  let loading = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let waiting: { frame: ViewFrame; ticket: number } | null = null;
  let seen: Layout | null = null;
  let transform = "";
  let moving = false;
  let blank = false;
  let boxed = container.clientWidth > 0;
  let held: LoadedImage | null = null;
  let shown = "";
  let clipped = "";

  const show = (canvas: boolean, fallback = canvas): void => {
    const next = `${canvas}${fallback}${motionReady}`;

    if (next === shown) {
      return;
    }

    shown = next;
    rest.style.visibility = fallback ? "visible" : "hidden";
    motion.style.visibility = fallback || !motionReady ? "hidden" : "visible";
    container.toggleAttribute("data-sharp", canvas);
  };

  const isIdle = (): boolean => {
    const state = cropper.getState();

    return state.interacting === null && !state.settling;
  };

  const backing = (frame: ViewFrame): CanvasRenderingContext2D | null => {
    const { dpr, width, height } = frame.layout;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));

    if (rest.width !== w || rest.height !== h) {
      rest.width = w;
      rest.height = h;
    }

    rest.style.width = `${w / dpr}px`;
    rest.style.height = `${h / dpr}px`;

    return rest.getContext("2d");
  };

  const paint = (
    frame: ViewFrame,
    bitmap: ImageBitmap,
    region: Region
  ): void => {
    const context = backing(frame);

    if (!context || !isAffine(frame.matrix) || context.isContextLost?.()) {
      blank = true;

      return;
    }

    blank = false;
    const { dpr } = frame.layout;
    const [a, c, e, b, d, f] = frame.matrix;
    const sx = region.width / bitmap.width;
    const sy = region.height / bitmap.height;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, rest.width, rest.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.setTransform(
      dpr * a * sx,
      dpr * b * sx,
      dpr * c * sy,
      dpr * d * sy,
      dpr * (a * region.x + c * region.y + e),
      dpr * (b * region.x + d * region.y + f)
    );

    context.drawImage(bitmap, 0, 0);
  };

  const reuse = (): void => {
    show(true);
    motion.style.willChange = "";
  };

  const sharpen = async (frame: ViewFrame, ticket: number): Promise<void> => {
    if (!image || !boxed || !isAffine(frame.matrix)) {
      return;
    }

    const current = image;
    const { refine } = await import("./sharpen");

    if (ticket !== token) {
      return;
    }

    const fine = await refine(frame, current, () => ticket === token).catch(
      () => null
    );
    const bitmap = fine?.bitmap;

    if (ticket !== token || !isIdle()) {
      bitmap?.close();

      return;
    }

    const source = bitmap ?? current.preview;

    paint(frame, source, fine?.region ?? whole(current));
    bitmap?.close();

    if (blank || !fine) {
      drawn = null;
      show(false, !blank);

      return;
    }

    drawn = { layout: frame.layout, matrix: frame.matrix };

    reuse();
  };

  const drain = (): void => {
    if (running || !waiting) {
      return;
    }

    const { frame, ticket } = waiting;

    waiting = null;

    if (ticket !== token) {
      return;
    }

    running = true;

    withTimeout(sharpen(frame, ticket), TIMEOUT_MS, undefined)
      .finally(() => {
        running = false;

        if (!moving) {
          motion.style.willChange = "";
        }

        drain();
      })
      .catch(noop);
  };

  const cancel = (): void => {
    token += 1;

    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
  };

  const schedule = (frame: ViewFrame, delay = 0): void => {
    cancel();
    const ticket = token;

    pending = setTimeout(() => {
      pending = null;
      waiting = { frame, ticket };
      drain();
    }, delay);
  };

  const isDrawn = (frame: ViewFrame): boolean =>
    drawn !== null &&
    sameMatrix(drawn.matrix, frame.matrix) &&
    sameBox(drawn.layout, frame.layout);

  const write = (frame: ViewFrame): void => {
    const clip = clipPath(frame.clip, cropShapeOf(cropper));

    if (clip !== clipped) {
      clipped = clip;
      container.style.clipPath = clip;
    }

    if (!image || !boxed) {
      return;
    }

    const { layout } = frame;
    const resized = seen !== null && !sameBox(seen, layout);

    seen = layout;
    const next = cssMatrix(frame.matrix);

    if (next !== transform) {
      transform = next;
      motion.style.transform = next;
    }

    if (isDrawn(frame)) {
      cancel();

      if (isIdle()) {
        reuse();
      }

      return;
    }

    if (motionReady) {
      show(false);
    } else {
      paint(frame, image.preview, whole(image));
      drawn = null;
      show(false, !blank);
    }

    if (isIdle()) {
      schedule(frame, resized ? LAYOUT_IDLE_MS : 0);
    }
  };

  const refresh = (): void => {
    const frame = view.frame();

    if (frame) {
      write(frame);
    }
  };

  const prepare = async (next: LoadedImage, ticket: number): Promise<void> => {
    const url = await takeFile(next);

    if (ticket !== loading) {
      return;
    }

    motion.src = url;
    await motion.decode();

    if (ticket === loading) {
      motionReady = true;

      if (moving || (drawn === null && (blank || !isIdle()))) {
        show(false);
      }
    }
  };

  const ensure = (): void => {
    if (image && boxed && held !== image) {
      held = image;
      prepare(image, loading).catch(noop);
    }
  };

  const clearMotion = (): void => {
    if (held) {
      dropFile(held);
      held = null;
    }

    if (motion.isConnected) {
      motion.removeAttribute("src");
    }
  };

  const load = (): void => {
    const next = imageOf(cropper);

    if (next === image) {
      return;
    }

    image = next;
    drawn = null;
    motionReady = false;
    token += 1;
    clearMotion();
    show(false);
    loading += 1;

    if (!next) {
      rest.width = 0;
      rest.height = 0;

      return;
    }

    motion.style.width = `${next.width}px`;
    motion.style.height = `${next.height}px`;
    ensure();
    refresh();
  };

  const sync = (): void => {
    const next = !isIdle();

    if (next === moving) {
      return;
    }

    moving = next;

    if (moving) {
      token += 1;
      motion.style.willChange = "transform";

      if (motionReady) {
        show(false);
      }
    } else {
      const frame = view.frame();

      if (frame && isDrawn(frame)) {
        reuse();
      } else if (frame) {
        schedule(frame);
      }
    }
  };

  const lost = (): void => {
    blank = true;
    drawn = null;
    cancel();
    show(false);
  };

  const wake = (): void => {
    load();
    ensure();
    refresh();
  };

  const onBox = (): void => {
    const next = container.clientWidth > 0;

    if (next !== boxed) {
      boxed = next;
      wake();
    }
  };

  afterPaint(async () => await import("./sharpen"));
  rest.addEventListener("contextlost", lost);
  rest.addEventListener("contextrestored", wake);
  const observer = new (windowOf(container).ResizeObserver)(onBox);

  observer.observe(container);
  load();
  const offImage = onImage(cropper, load);
  const offFrame = view.onFrame(write);
  const offState = cropper.subscribe(sync);

  sync();

  return () => {
    offImage();
    offFrame();
    offState();
    observer.disconnect();
    rest.removeEventListener("contextlost", lost);
    rest.removeEventListener("contextrestored", wake);
    cancel();
    loading += 1;
    clearMotion();
    rest.width = 0;
    rest.height = 0;
    container.style.clipPath = "";
  };
};

export { bindPhoto };
