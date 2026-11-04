import type { ExportPlan } from "../geometry/export-plan";
import type { Size } from "../geometry/types";
import { ZrizError } from "./error";
import { fitEdge, textOf } from "./media";
import { TIMEOUT, aborted, deadline, noop } from "./turn";
import { decodeOff, decodeTurn, keepOff, releaseOff } from "./worker";

type ImageSource =
  | Blob
  | string
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap;

type LoadOptions = {
  previewEdge?: number | undefined;
  crossOrigin?: "anonymous" | "use-credentials" | undefined;
  signal?: AbortSignal | undefined;
  timeout?: number | undefined;
  decode?: ((blob: Blob) => Promise<ImageBitmap>) | undefined;
};

type LoadedImage = {
  id: number;
  width: number;
  height: number;
  preview: ImageBitmap;
  source: Blob | ImageBitmap;
  mime: string | null;
  animated: boolean;
};

type ExportOptions = {
  type?: "image/png" | "image/jpeg" | "image/webp" | undefined;
  quality?: number | undefined;
  maxSize?: Size | undefined;
  colorSpace?: "srgb" | "display-p3" | undefined;
  shape?: "rect" | "circle" | undefined;
  signal?: AbortSignal | undefined;
};

type ExportResult = {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  scaled: boolean;
  crop: ExportPlan;
};

let nextId = 0;
const TOUCH_AREA = 16_777_216;
const NON_TOUCH_AREA = 268_435_456;
const HEAD = 4096;

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
  at = 0
): boolean => signature.every((byte, i) => bytes[at + i] === byte);

const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  String.fromCodePoint(...bytes.subarray(from, to));

const uint32 = (bytes: Uint8Array, at: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.length).getUint32(at);

const hasAnimationChunk = (bytes: Uint8Array): boolean => {
  let at = 8;

  while (at + 8 <= bytes.length) {
    const chunk = ascii(bytes, at + 4, at + 8);

    if (chunk === "acTL" || chunk === "IDAT") {
      return chunk === "acTL";
    }

    at += 12 + uint32(bytes, at);
  }

  return false;
};

const isoBrands = (bytes: Uint8Array): string[] => {
  const end = Math.min(uint32(bytes, 0), bytes.length);

  return (ascii(bytes, 8, 12) + ascii(bytes, 16, end)).match(/.{4}/gsu) ?? [];
};

const raster = (
  bytes: Uint8Array
): { mime: string | null; animated: boolean } => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { animated: false, mime: "image/jpeg" };
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return { animated: hasAnimationChunk(bytes), mime: "image/png" };
  }

  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return {
      animated: ascii(bytes, 12, 16) === "VP8X" && (bytes[20] ?? 0) % 4 >= 2,
      mime: "image/webp",
    };
  }

  if (ascii(bytes, 0, 4) === "GIF8") {
    return { animated: true, mime: "image/gif" };
  }

  if (ascii(bytes, 4, 8) === "ftyp") {
    const brands = isoBrands(bytes);
    const has = (pattern: RegExp): boolean =>
      brands.some((brand) => pattern.test(brand));

    if (has(/^avi[fs]$/u)) {
      return { animated: brands.includes("avis"), mime: "image/avif" };
    }

    if (has(/^(?:hei[cxms]|hev[cxms]|m[is]f1)$/u)) {
      return { animated: has(/^(?:hev[cxms]|msf1)$/u), mime: "image/heic" };
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

const hasTouchScreen = (): boolean =>
  typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

const outputLimit = (): number =>
  hasTouchScreen() ? TOUCH_AREA : NON_TOUCH_AREA;

const defaultPreviewEdge = (): number => {
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const viewport =
    typeof screen === "undefined"
      ? 1280
      : Math.max(screen.width, screen.height);

  return Math.min(
    Math.ceil(viewport * dpr * 2),
    hasTouchScreen() ? 4096 : 8192
  );
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
  signal: AbortSignal
): Promise<Blob> => {
  try {
    const response = await fetch(src, {
      credentials:
        crossOrigin === "use-credentials" ? "include" : "same-origin",
      mode: "cors",
      signal,
    });

    if (!response.ok) {
      throw new ZrizError(
        "decode",
        `zriz: ${response.status} for ${src.replace(/[?#].*/su, "").slice(0, 80)}`
      );
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof ZrizError) {
      throw error;
    }

    if (signal.aborted) {
      throw aborted();
    }

    throw new ZrizError(
      "cross-origin",
      /^(?:blob|data):/u.test(src)
        ? "zriz: could not read this url. Check connect-src."
        : "zriz: could not fetch the image. Check CORS, connect-src and the network."
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
    code === "undecodable" &&
    mime !== null &&
    ["image/heic", "image/jxl", "image/tiff"].includes(mime)
  ) {
    return new ZrizError(
      "unsupported-format",
      `zriz: could not decode this ${mime} file. It may be unsupported or damaged. A decode function adds a decoder.`
    );
  }

  return new ZrizError(
    code === "blank" ? "blank" : "decode",
    `zriz: ${detail}`
  );
};

const freeImage = (image: LoadedImage): void => {
  void releaseOff(image.id);
  image.preview.close();

  if (image.source instanceof ImageBitmap && image.source !== image.preview) {
    image.source.close();
  }
};

const loadImage = async (
  src: ImageSource,
  options: LoadOptions = {}
): Promise<LoadedImage> => {
  const asked = options.previewEdge ?? 0;
  const edge = asked > 0 ? asked : defaultPreviewEdge();

  nextId += 1;
  const id = nextId;
  const cancel = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, cancel.signal])
    : cancel.signal;
  const held: ImageBitmap[] = [];
  const ms = options.timeout ?? TIMEOUT;
  const limit = deadline(ms, options.signal);
  let inHook = false;

  const own = (bitmap: ImageBitmap): ImageBitmap => {
    if (bitmap !== src) {
      held.push(bitmap);
    }

    return bitmap;
  };

  const checkpoint = (): void => {
    if (signal.aborted) {
      throw aborted();
    }
  };

  const work = async (): Promise<LoadedImage> => {
    let mime: string | null = null;
    let animated = false;
    const loaded = (
      preview: ImageBitmap,
      source: LoadedImage["source"],
      { width, height }: Size
    ): LoadedImage => ({
      animated,
      height,
      id,
      mime,
      preview,
      source,
      width,
    });

    checkpoint();

    if (typeof src === "string" || "arrayBuffer" in src) {
      let blob: Blob;

      if (typeof src === "string") {
        blob = await toBlob(src, options.crossOrigin, signal);
      } else {
        blob = Object.prototype.isPrototypeOf.call(Blob.prototype, src)
          ? src
          : new Blob([src], { type: src.type });
      }

      const head = new Uint8Array(await blob.slice(0, HEAD).arrayBuffer());

      checkpoint();
      ({ mime, animated } = raster(head));
      const typed = blob.type.startsWith("image/svg+xml");
      const vector =
        mime === null && (typed || /<svg/iu.test(textOf(head)))
          ? await import("./svg")
          : null;

      if (vector && (typed || vector.isSvg(head))) {
        mime = "image/svg+xml";
        const preview = own(await vector.fromSvg(blob, edge));

        await keepOff(id, preview);

        return loaded(preview, preview, preview);
      }

      const resume = limit.pause();
      const decoded = await decodeTurn(
        async () => {
          resume();

          return await decodeOff(blob, edge, id);
        },
        ms,
        signal
      ).catch(async (error: unknown) => {
        if (!options.decode) {
          throw toZriz(error, mime);
        }

        checkpoint();
        inHook = true;
        const full = own(await options.decode(blob));

        inHook = false;
        const { assertReadable } = await import("./source");

        assertReadable(full);
        const preview = own(await resizeBitmap(full, edge));

        await keepOff(id, preview);

        return { full, height: full.height, preview, width: full.width };
      });

      return loaded(
        decoded.preview,
        "full" in decoded ? decoded.full : blob,
        decoded
      );
    }

    const { fromElement } = await import("./source");
    const source = own(await fromElement(src, outputLimit()));
    const preview = own(await resizeBitmap(source, edge));

    await keepOff(id, preview);

    return loaded(preview, source, source);
  };

  const guarded = async (): Promise<LoadedImage> => {
    try {
      return await work();
    } catch (error) {
      for (const bitmap of held) {
        bitmap.close();
      }

      throw error;
    }
  };

  const pending = guarded();

  try {
    return await Promise.race([pending, limit.promise]);
  } catch (error) {
    cancel.abort();
    void pending.then(freeImage, noop);
    throw inHook ? error : toZriz(error);
  } finally {
    limit.clear();
  }
};

export type {
  ExportOptions,
  ExportResult,
  ImageSource,
  LoadOptions,
  LoadedImage,
};
export {
  defaultPreviewEdge,
  freeImage,
  loadImage,
  outputLimit,
  raster,
  toZriz,
};
