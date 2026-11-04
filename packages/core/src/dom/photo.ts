import type { Cropper } from "../cropper";
import type { Matrix3 } from "../geometry/types";
import type { LoadedImage } from "./image";
import { imageOf, onImage } from "./image-store";
import type { Region } from "./kernel";
import { afterPaint } from "./later";
import { TIMEOUT, withTimeout } from "./turn";
import { cssMatrix, viewOf } from "./view";
import type { ViewFrame } from "./view";
import { motionOff } from "./worker";

interface Drawn {
  matrix: Matrix3;
  width: number;
  height: number;
  dpr: number;
}

const SAME = 1e-6;
const LAYOUT_IDLE = 120;

const sameMatrix = (a: Matrix3, b: Matrix3): boolean =>
  a.every((value, i) => Math.abs(value - (b[i] ?? 0)) < SAME);

const isAffine = (m: Matrix3): boolean =>
  m[6] === 0 && m[7] === 0 && m[8] === 1;

const motionType = (image: LoadedImage): string =>
  image.mime === "image/jpeg" ? "image/jpeg" : "image/png";

const whole = (image: LoadedImage): Region => ({
  height: image.height,
  width: image.width,
  x: 0,
  y: 0,
});

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

export const bindPhoto = (
  cropper: Cropper,
  container: HTMLElement
): (() => void) => {
  const view = viewOf(cropper);
  const motion = childOf(container, "img");
  const rest = childOf(container, "canvas");
  container.style.position = "absolute";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.overflow = "hidden";
  motion.alt = "";
  motion.draggable = false;
  motion.decoding = "async";
  Object.assign(motion.style, {
    border: "0",
    left: "0",
    maxHeight: "none",
    maxWidth: "none",
    minHeight: "0",
    minWidth: "0",
    padding: "0",
    position: "absolute",
    top: "0",
    transformOrigin: "0 0",
    transition: "none",
    visibility: "hidden",
  });
  Object.assign(rest.style, {
    height: "100%",
    left: "0",
    position: "absolute",
    top: "0",
    transition: "none",
    visibility: "hidden",
    width: "100%",
  });
  let image: LoadedImage | null = null;
  let url: string | null = null;
  let motionReady = false;
  let drawn: Drawn | null = null;
  let token = 0;
  let loading = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let waiting: { frame: ViewFrame; ticket: number } | null = null;
  let seen: ViewFrame["layout"] | null = null;
  let transform = "";
  let moving = false;
  let blank = false;

  let shown = "";
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

  const settled = (): boolean => {
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
    return rest.getContext("2d");
  };

  const paint = (
    frame: ViewFrame,
    bitmap: CanvasImageSource,
    region: Region,
    size: { width: number; height: number }
  ): void => {
    const context = backing(frame);
    blank =
      !context ||
      !isAffine(frame.matrix) ||
      (context.isContextLost?.() ?? false);
    if (blank || !context) {
      return;
    }
    const { dpr } = frame.layout;
    const [a, c, e, b, d, f] = frame.matrix;
    const sx = region.width / size.width;
    const sy = region.height / size.height;
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
    if (!image || !isAffine(frame.matrix)) {
      return;
    }
    const current = image;
    const { refine } = await import("./sharpen");
    if (ticket !== token) {
      return;
    }
    const { bitmap, region } = await refine(
      frame,
      current,
      () => ticket === token
    ).catch(() => ({ bitmap: null, region: whole(current) }));
    if (ticket !== token || !settled()) {
      bitmap?.close();
      return;
    }
    const source = bitmap ?? current.preview;
    paint(frame, source, region, source);
    bitmap?.close();
    if (blank) {
      show(false);
      return;
    }
    drawn = {
      dpr: frame.layout.dpr,
      height: frame.layout.height,
      matrix: frame.matrix,
      width: frame.layout.width,
    };
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
    withTimeout(sharpen(frame, ticket), TIMEOUT, undefined)
      .finally(() => {
        running = false;
        if (!moving) {
          motion.style.willChange = "";
        }
        drain();
      })
      .catch(() => null);
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
    drawn.width === frame.layout.width &&
    drawn.height === frame.layout.height &&
    drawn.dpr === frame.layout.dpr;

  const write = (frame: ViewFrame): void => {
    if (!image) {
      return;
    }
    const { layout } = frame;
    const resized =
      seen !== null &&
      (seen.width !== layout.width ||
        seen.height !== layout.height ||
        seen.dpr !== layout.dpr);
    seen = layout;
    const next = cssMatrix(frame.matrix);
    if (next !== transform) {
      transform = next;
      motion.style.transform = next;
    }
    if (isDrawn(frame)) {
      cancel();
      if (settled()) {
        reuse();
      }
      return;
    }
    if (motionReady) {
      show(false);
    } else {
      paint(frame, image.preview, whole(image), image.preview);
      drawn = null;
      show(false, !blank);
    }
    if (settled()) {
      schedule(frame, resized ? LAYOUT_IDLE : 0);
    }
  };

  const refresh = (): void => {
    const frame = view.frame();
    if (frame) {
      write(frame);
    }
  };

  const prepare = async (next: LoadedImage, ticket: number): Promise<void> => {
    const blob = await motionOff(next.id, motionType(next));
    if (ticket !== loading) {
      return;
    }
    url = URL.createObjectURL(blob);
    motion.src = url;
    await motion.decode();
    if (ticket === loading) {
      motionReady = true;
      if (drawn === null && (blank || !settled())) {
        show(false);
      }
    }
  };

  const clearMotion = (): void => {
    if (url !== null) {
      URL.revokeObjectURL(url);
      url = null;
    }
    motion.removeAttribute("src");
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
    prepare(next, loading).catch(() => null);
    refresh();
  };

  const sync = (): void => {
    const next = !settled();
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

  afterPaint(async () => await import("./sharpen"));
  rest.addEventListener("contextlost", lost);
  rest.addEventListener("contextrestored", refresh);
  load();
  const offImage = onImage(cropper, load);
  const offFrame = view.onFrame(write);
  const offState = cropper.subscribe(sync);
  return () => {
    offImage();
    offFrame();
    offState();
    rest.removeEventListener("contextlost", lost);
    rest.removeEventListener("contextrestored", refresh);
    cancel();
    loading += 1;
    clearMotion();
    rest.width = 0;
    rest.height = 0;
  };
};
