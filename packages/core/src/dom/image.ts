import type { ExportPlan } from "../geometry/export-plan";
import type { Size } from "../geometry/types";
import { ZrizError } from "./error";
import { fitEdge } from "./media";
import { decodeOff, keepOff } from "./worker";

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
  id: number;
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

export const TIMEOUT = 15_000;
let nextId = 0;
const MOBILE_AREA = 16_777_216;
const DESKTOP_AREA = 268_435_456;

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
  at = 0
): boolean => signature.every((byte, i) => bytes[at + i] === byte);

const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  String.fromCodePoint(...bytes.subarray(from, to));

export const raster = (
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
  return { animated: false, mime: null };
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

export const withTimeout = async <T>(
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

export const toZriz = (
  error: unknown,
  mime: string | null = null
): ZrizError => {
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
  nextId += 1;
  const id = nextId;
  const work = async (): Promise<LoadedImage> => {
    let mime: string | null = null;
    let animated = false;
    if (typeof src === "string" || src instanceof Blob) {
      const blob =
        typeof src === "string"
          ? await toBlob(src, options.crossOrigin, options.signal)
          : src;
      const head = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
      ({ mime, animated } = raster(head));
      const typed = blob.type === "image/svg+xml";
      const vector =
        mime === null &&
        (typed || /<svg/iu.test(new TextDecoder().decode(head)))
          ? await import("./svg").catch((error: unknown) => {
              throw toZriz(error, mime);
            })
          : null;
      if (vector && (typed || vector.sniff(head).mime !== null)) {
        mime = "image/svg+xml";
        const preview = await vector.fromSvg(blob, edge);
        await keepOff(id, preview);
        return {
          animated,
          height: preview.height,
          id,
          mime,
          preview,
          source: preview,
          width: preview.width,
        };
      }
      const decoded = await decodeOff(blob, edge, id).catch(
        async (error: unknown) => {
          if (!options.decode) {
            throw toZriz(error, mime);
          }
          const full = await options.decode(blob);
          const preview = await resizeBitmap(full, edge);
          await keepOff(id, preview);
          return { full, height: full.height, preview, width: full.width };
        }
      );
      const { preview, width, height } = decoded;
      return {
        animated,
        height,
        id,
        mime,
        preview,
        source: "full" in decoded ? decoded.full : blob,
        width,
      };
    }
    let source: ImageBitmap;
    if (src instanceof ImageBitmap) {
      source = src;
    } else {
      const element = await import("./source").catch((error: unknown) => {
        throw toZriz(error);
      });
      source = await element.fromElement(src);
    }
    const preview = await resizeBitmap(source, edge);
    await keepOff(id, preview);
    return {
      animated,
      height: source.height,
      id,
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
