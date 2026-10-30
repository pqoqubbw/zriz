import type { Cropper } from "../cropper";
import type { ExportPlan } from "../geometry/export-plan";
import type { Size } from "../geometry/types";
import { decodeOff, renderHere, renderOff } from "./worker";

export type ZrizErrorCode =
  | "cross-origin"
  | "unsupported-format"
  | "decode"
  | "timeout"
  | "aborted"
  | "blank"
  | "no-image";

export class ZrizError extends Error {
  readonly code: ZrizErrorCode;

  constructor(code: ZrizErrorCode, message: string) {
    super(message);
    this.name = "ZrizError";
    this.code = code;
  }
}

export type ImageSource =
  | Blob
  | string
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap;

export interface LoadOptions {
  previewEdge?: number | undefined;
  crossOrigin?: "anonymous" | "use-credentials" | undefined;
  signal?: AbortSignal | undefined;
  timeout?: number | undefined;
  decode?: ((blob: Blob) => Promise<ImageBitmap>) | undefined;
}

export interface LoadedImage {
  width: number;
  height: number;
  preview: ImageBitmap;
  source: Blob | ImageBitmap;
  mime: string | null;
  animated: boolean;
}

export interface ExportOptions {
  type?: "image/png" | "image/jpeg" | "image/webp" | undefined;
  quality?: number | undefined;
  maxSize?: Size | undefined;
  colorSpace?: "srgb" | "display-p3" | undefined;
  shape?: "rect" | "circle" | undefined;
  signal?: AbortSignal | undefined;
}

export interface ExportResult {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  scaled: boolean;
  crop: ExportPlan;
}

const TIMEOUT = 15_000;
const QUALITY = 0.9;
const MOBILE_AREA = 16_777_216;
const DESKTOP_AREA = 268_435_456;

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
  at = 0
): boolean => signature.every((byte, i) => bytes[at + i] === byte);

const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  String.fromCodePoint(...bytes.subarray(from, to));

export const sniff = (
  bytes: Uint8Array
): { mime: string | null; animated: boolean } => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { animated: false, mime: "image/jpeg" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return {
      animated: ascii(bytes, 0, 256).includes("acTL"),
      mime: "image/png",
    };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return {
      animated: ascii(bytes, 12, 64).includes("ANIM"),
      mime: "image/webp",
    };
  }
  if (ascii(bytes, 0, 4) === "GIF8") {
    return { animated: true, mime: "image/gif" };
  }
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brands = ascii(bytes, 8, 32);
    if (brands.includes("avif") || brands.includes("avis")) {
      return { animated: brands.includes("avis"), mime: "image/avif" };
    }
    if (/heic|heix|mif1|hevc/u.test(brands)) {
      return { animated: false, mime: "image/heic" };
    }
  }
  if (startsWith(bytes, [0xff, 0x0a]) || ascii(bytes, 4, 8) === "JXL ") {
    return { animated: false, mime: "image/jxl" };
  }
  if (ascii(bytes, 0, 2) === "BM") {
    return { animated: false, mime: "image/bmp" };
  }
  if (ascii(bytes, 0, 4) === "II*\0" || ascii(bytes, 0, 4) === "MM\0*") {
    return { animated: false, mime: "image/tiff" };
  }
  const text = new TextDecoder().decode(bytes.subarray(0, 512));
  if (
    /^\s*(?:<\?xml[^>]*\?>\s*)?(?:(?:<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)\s*)*<svg[\s>]/iu.test(
      text
    )
  ) {
    return { animated: false, mime: "image/svg+xml" };
  }
  return { animated: false, mime: null };
};

const svgLength = (value: string | undefined): number => {
  if (value === undefined || value.endsWith("%")) {
    return 0;
  }
  const parsed = Number(value.replace(/px$/u, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const svgSize = (text: string): Size => {
  const tag = /<svg\b[^>]*>/iu.exec(text)?.[0] ?? "";
  const attribute = (name: string): string | undefined =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "iu").exec(tag)?.[1];
  const [boxWidth = 0, boxHeight = 0] = (attribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/u)
    .map(Number)
    .slice(2, 4);
  const ratio = boxWidth > 0 && boxHeight > 0 ? boxWidth / boxHeight : 0;
  const width = svgLength(attribute("width"));
  const height = svgLength(attribute("height"));
  if (width > 0 && height > 0) {
    return { height, width };
  }
  if (width > 0 && ratio > 0) {
    return { height: width / ratio, width };
  }
  if (height > 0 && ratio > 0) {
    return { height, width: height * ratio };
  }
  if (ratio > 0) {
    return { height: boxHeight, width: boxWidth };
  }
  return { height: 150, width: 300 };
};

const noop = (): void => undefined;

const deadline = (
  ms: number,
  signal: AbortSignal | undefined
): { promise: Promise<never>; clear: () => void } => {
  let clear = noop;
  const promise = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ZrizError("timeout", `zriz: decode took over ${ms} ms`));
    }, ms);
    const abort = (): void => {
      reject(new ZrizError("aborted", "zriz: aborted"));
    };
    if (signal?.aborted === true) {
      abort();
    }
    signal?.addEventListener("abort", abort, { once: true });
    clear = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
  });
  return { clear, promise };
};

const withTimeout = async <T>(
  work: Promise<T>,
  ms: number,
  signal: AbortSignal | undefined
): Promise<T> => {
  const limit = deadline(ms, signal);
  try {
    return await Promise.race([work, limit.promise]);
  } finally {
    limit.clear();
  }
};

const fitEdge = (size: Size, edge: number): Size => {
  const scale = Math.min(1, edge / Math.max(size.width, size.height));
  return {
    height: Math.max(1, Math.round(size.height * scale)),
    width: Math.max(1, Math.round(size.width * scale)),
  };
};

const isMobile = (): boolean =>
  typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

export const defaultPreviewEdge = (): number => {
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const viewport =
    typeof screen === "undefined"
      ? 1280
      : Math.max(screen.width, screen.height);
  return Math.min(Math.ceil(viewport * dpr * 2), isMobile() ? 4096 : 8192);
};

const resizeBitmap = async (
  bitmap: ImageBitmap,
  edge: number
): Promise<ImageBitmap> => {
  const size = fitEdge(bitmap, edge);
  if (size.width === bitmap.width && size.height === bitmap.height) {
    return bitmap;
  }
  return await createImageBitmap(bitmap, {
    resizeHeight: size.height,
    resizeQuality: "medium",
    resizeWidth: size.width,
  });
};

const canvasFor = (size: Size): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(size.width, size.height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
};

const context2d = (
  canvas: OffscreenCanvas | HTMLCanvasElement,
  colorSpace: PredefinedColorSpace = "srgb"
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D => {
  const context = canvas.getContext("2d", { colorSpace });
  if (!context) {
    throw new ZrizError("decode", "zriz: no 2D canvas");
  }
  return context;
};

const free = (canvas: OffscreenCanvas | HTMLCanvasElement): void => {
  canvas.width = 0;
  canvas.height = 0;
};

const drawn = async (
  source: CanvasImageSource,
  size: Size
): Promise<ImageBitmap> => {
  const canvas = canvasFor(size);
  context2d(canvas).drawImage(source, 0, 0, size.width, size.height);
  try {
    return await createImageBitmap(canvas);
  } finally {
    free(canvas);
  }
};

const assertReadable = (source: CanvasImageSource): void => {
  const canvas = canvasFor({ height: 1, width: 1 });
  const context = context2d(canvas);
  context.drawImage(source, 0, 0, 1, 1);
  try {
    context.getImageData(0, 0, 1, 1);
  } catch {
    throw new ZrizError(
      "cross-origin",
      "zriz: the image is cross-origin without CORS. Serve it with Access-Control-Allow-Origin and set crossOrigin."
    );
  } finally {
    free(canvas);
  }
};

const loadElement = async (
  url: string,
  crossOrigin: LoadOptions["crossOrigin"]
): Promise<HTMLImageElement> => {
  const image = new Image();
  if (crossOrigin) {
    image.crossOrigin = crossOrigin;
  }
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new ZrizError("decode", `zriz: could not load ${url.slice(0, 80)}`);
  }
  return image;
};

const fromSvg = async (blob: Blob, edge: number): Promise<ImageBitmap> => {
  const size = fitEdge(svgSize(await blob.text()), edge * 4);
  const url = URL.createObjectURL(blob);
  try {
    return await drawn(await loadElement(url, undefined), fitEdge(size, edge));
  } finally {
    URL.revokeObjectURL(url);
  }
};

const toBlob = async (
  src: string,
  crossOrigin: LoadOptions["crossOrigin"],
  signal: AbortSignal | undefined
): Promise<Blob> => {
  try {
    const response = await fetch(src, {
      credentials:
        crossOrigin === "use-credentials" ? "include" : "same-origin",
      mode: "cors",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      throw new ZrizError(
        "decode",
        `zriz: ${response.status} for ${src.slice(0, 80)}`
      );
    }
    return await response.blob();
  } catch (error) {
    if (error instanceof ZrizError) {
      throw error;
    }
    if (signal?.aborted === true) {
      throw new ZrizError("aborted", "zriz: aborted");
    }
    throw new ZrizError(
      "cross-origin",
      "zriz: the image could not be fetched with CORS. Serve it with Access-Control-Allow-Origin."
    );
  }
};

const toZriz = (error: unknown, mime: string | null = null): ZrizError => {
  if (error instanceof ZrizError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  const match = /^zriz:(?<code>[\w-]+):(?<detail>.*)$/u.exec(message);
  const code = match?.groups?.code ?? "decode";
  const detail = match?.groups?.detail ?? message;
  if (
    code === "decode" &&
    mime !== null &&
    ["image/heic", "image/jxl", "image/tiff"].includes(mime)
  ) {
    return new ZrizError(
      "unsupported-format",
      `zriz: this browser cannot decode ${mime}. Pass a decode function to add a decoder.`
    );
  }
  return new ZrizError(
    code === "blank" ? "blank" : "decode",
    `zriz: ${detail}`
  );
};

const dispose = async (pending: Promise<LoadedImage>): Promise<void> => {
  const late = await pending.catch(() => null);
  late?.preview.close();
  if (
    late &&
    late.source instanceof ImageBitmap &&
    late.source !== late.preview
  ) {
    late.source.close();
  }
};

export const loadImage = async (
  src: ImageSource,
  options: LoadOptions = {}
): Promise<LoadedImage> => {
  const edge = options.previewEdge ?? defaultPreviewEdge();
  const work = async (): Promise<LoadedImage> => {
    let source: Blob | ImageBitmap;
    let mime: string | null = null;
    let animated = false;
    if (typeof src === "string" || src instanceof Blob) {
      const blob =
        typeof src === "string"
          ? await toBlob(src, options.crossOrigin, options.signal)
          : src;
      const head = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
      ({ mime, animated } = sniff(head));
      if (mime === null && blob.type === "image/svg+xml") {
        mime = blob.type;
      }
      if (mime === "image/svg+xml") {
        const preview = await fromSvg(blob, edge);
        return {
          animated,
          height: preview.height,
          mime,
          preview,
          source: preview,
          width: preview.width,
        };
      }
      const decoded = await decodeOff(blob, edge).catch(
        async (error: unknown) => {
          if (!options.decode) {
            throw toZriz(error, mime);
          }
          const full = await options.decode(blob);
          const preview = await resizeBitmap(full, edge);
          return { full, height: full.height, preview, width: full.width };
        }
      );
      const { preview, width, height } = decoded;
      return {
        animated,
        height,
        mime,
        preview,
        source: "full" in decoded ? decoded.full : blob,
        width,
      };
    }
    if (src instanceof ImageBitmap) {
      source = src;
    } else if (
      typeof HTMLVideoElement !== "undefined" &&
      src instanceof HTMLVideoElement
    ) {
      assertReadable(src);
      source = await drawn(src, {
        height: src.videoHeight,
        width: src.videoWidth,
      });
    } else if (
      typeof HTMLImageElement !== "undefined" &&
      src instanceof HTMLImageElement
    ) {
      if (!src.complete || src.naturalWidth === 0) {
        await src.decode();
      }
      assertReadable(src);
      source = await createImageBitmap(src);
    } else {
      assertReadable(src);
      source = await createImageBitmap(src);
    }
    const preview = await resizeBitmap(source, edge);
    return {
      animated,
      height: source.height,
      mime,
      preview,
      source,
      width: source.width,
    };
  };
  const pending = work();
  try {
    return await withTimeout(
      pending,
      options.timeout ?? TIMEOUT,
      options.signal
    );
  } catch (error) {
    void dispose(pending);
    throw error;
  }
};

export const outputLimit = (): number =>
  isMobile() ? MOBILE_AREA : DESKTOP_AREA;

export const exportImage = async (
  cropper: Cropper,
  image: LoadedImage,
  options: ExportOptions = {}
): Promise<ExportResult> => {
  const state = cropper.getCropState();
  const base = cropper.getPixelCrop(1);
  if (!state || !base) {
    throw new ZrizError("no-image", "zriz: nothing to export yet");
  }
  const type =
    options.type ?? (options.shape === "circle" ? "image/png" : "image/jpeg");
  const fit = options.maxSize
    ? Math.min(
        1,
        options.maxSize.width / base.width,
        options.maxSize.height / base.height
      )
    : 1;
  const first = Math.min(
    fit,
    Math.sqrt(outputLimit() / (base.width * base.height))
  );
  const scales = [first, first / 2, first / 4];
  const crops = scales.map((scale) => cropper.getPixelCrop(scale) ?? base);
  const plans = crops.map((plan) => ({
    forward: plan.forward,
    height: plan.height,
    homography: plan.homography,
    width: plan.width,
  }));
  const wide =
    options.colorSpace === "display-p3" && image.source instanceof Blob;
  const url =
    wide && image.source instanceof Blob
      ? URL.createObjectURL(image.source)
      : null;
  try {
    const element = url === null ? null : await loadElement(url, undefined);
    const source = element
      ? {
          drawable: element,
          height: element.naturalHeight,
          width: element.naturalWidth,
        }
      : image.source;
    const render = element ? renderHere : renderOff;
    const { blob, index } = await withTimeout(
      render({
        circle: options.shape === "circle",
        colorSpace: options.colorSpace ?? "srgb",
        image: state.image,
        plans,
        quality: options.quality ?? QUALITY,
        source,
        type,
      }),
      TIMEOUT * 2,
      options.signal
    );
    const crop = crops[index] ?? base;
    return {
      blob,
      crop,
      height: crop.height,
      scaled: (scales[index] ?? first) < 1,
      type: blob.type,
      width: crop.width,
    };
  } catch (error) {
    throw toZriz(error, image.mime);
  } finally {
    if (url !== null) {
      URL.revokeObjectURL(url);
    }
  }
};

const attached = new WeakMap<Cropper, LoadedImage>();

export const attachImage = (
  cropper: Cropper,
  image: LoadedImage | null
): void => {
  const previous = attached.get(cropper);
  if (previous && previous !== image) {
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
};

export const imageOf = (cropper: Cropper): LoadedImage | null =>
  attached.get(cropper) ?? null;

export const exportCrop = async (
  cropper: Cropper,
  options?: ExportOptions
): Promise<ExportResult> => {
  const image = attached.get(cropper);
  if (!image) {
    throw new ZrizError("no-image", "zriz: load a photo before exporting");
  }
  return await exportImage(cropper, image, options);
};
