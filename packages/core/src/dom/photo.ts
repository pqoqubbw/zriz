import type { Cropper } from "../cropper";
import type { Matrix3 } from "../geometry/types";
import type { LoadedImage } from "./image";
import { imageOf, onImage } from "./image-store";
import { afterPaint } from "./later";
import { cssMatrix, viewOf } from "./view";
import type { ViewFrame } from "./view";
import { motionOff } from "./worker";

interface Drawn {
  matrix: Matrix3;
  width: number;
  height: number;
}

const SAME = 1e-6;

const sameMatrix = (a: Matrix3, b: Matrix3): boolean =>
  a.every((value, i) => Math.abs(value - (b[i] ?? 0)) < SAME);

const isAffine = (m: Matrix3): boolean =>
  m[6] === 0 && m[7] === 0 && m[8] === 1;

const motionType = (image: LoadedImage): string =>
  image.mime === "image/jpeg" ? "image/jpeg" : "image/png";

const childOf = <K extends "img" | "canvas">(
  container: HTMLElement,
  tag: K
): HTMLElementTagNameMap[K] => {
  const found = container.querySelector(tag);
  if (found) {
    return found;
  }
  const made = document.createElement(tag);
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
    left: "0",
    maxWidth: "none",
    position: "absolute",
    top: "0",
    transformOrigin: "0 0",
    visibility: "hidden",
  });
  Object.assign(rest.style, {
    height: "100%",
    left: "0",
    position: "absolute",
    top: "0",
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
  let transform = "";
  let moving = false;

  const show = (canvas: boolean): void => {
    rest.style.visibility = canvas ? "visible" : "hidden";
    motion.style.visibility = canvas || !motionReady ? "hidden" : "visible";
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
    region: { x: number; y: number; width: number; height: number },
    size: { width: number; height: number }
  ): void => {
    const context = backing(frame);
    if (!context) {
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

  const sharpen = async (frame: ViewFrame, ticket: number): Promise<void> => {
    if (!image || !isAffine(frame.matrix)) {
      return;
    }
    const current = image;
    const { refine } = await import("./sharpen");
    if (ticket !== token) {
      return;
    }
    const { bitmap, region } = await refine(frame, current);
    if (ticket !== token || !settled()) {
      bitmap?.close();
      return;
    }
    const source = bitmap ?? current.preview;
    paint(frame, source, region, source);
    bitmap?.close();
    drawn = {
      height: frame.layout.height,
      matrix: frame.matrix,
      width: frame.layout.width,
    };
    show(true);
    motion.style.willChange = "";
  };

  const schedule = (frame: ViewFrame): void => {
    token += 1;
    const ticket = token;
    if (pending !== null) {
      clearTimeout(pending);
    }
    pending = setTimeout(() => {
      pending = null;
      sharpen(frame, ticket).catch(() => null);
    }, 0);
  };

  const write = (frame: ViewFrame): void => {
    if (!image) {
      return;
    }
    const next = cssMatrix(frame.matrix);
    if (next !== transform) {
      transform = next;
      motion.style.transform = next;
    }
    const current =
      drawn !== null &&
      sameMatrix(drawn.matrix, frame.matrix) &&
      drawn.width === frame.layout.width &&
      drawn.height === frame.layout.height;
    if (current) {
      return;
    }
    if (motionReady) {
      show(false);
    } else {
      paint(
        frame,
        image.preview,
        { height: image.height, width: image.width, x: 0, y: 0 },
        image.preview
      );
      drawn = null;
      rest.style.visibility = "visible";
    }
    if (settled()) {
      schedule(frame);
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
      if (drawn === null && !settled()) {
        show(false);
      }
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
    if (url !== null) {
      URL.revokeObjectURL(url);
      url = null;
    }
    motion.removeAttribute("src");
    show(false);
    if (!next) {
      return;
    }
    motion.style.width = `${next.width}px`;
    motion.style.height = `${next.height}px`;
    loading += 1;
    prepare(next, loading).catch(() => null);
    const frame = view.frame();
    if (frame) {
      write(frame);
    }
  };

  const sync = (): void => {
    const next = !settled();
    if (next === moving) {
      return;
    }
    moving = next;
    if (moving) {
      token += 1;
      drawn = null;
      motion.style.willChange = "transform";
      if (motionReady) {
        show(false);
      }
    } else {
      const frame = view.frame();
      if (frame) {
        schedule(frame);
      }
    }
  };

  afterPaint(async () => await import("./sharpen"));
  load();
  const offImage = onImage(cropper, load);
  const offFrame = view.onFrame(write);
  const offState = cropper.subscribe(sync);
  return () => {
    offImage();
    offFrame();
    offState();
    token += 1;
    loading += 1;
    if (pending !== null) {
      clearTimeout(pending);
    }
    if (url !== null) {
      URL.revokeObjectURL(url);
    }
    rest.width = 0;
    rest.height = 0;
  };
};
