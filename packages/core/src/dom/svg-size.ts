import type { Size } from "../geometry/types";
import { raster } from "./image";
import { textOf } from "./media";

const FALLBACK: Size = { height: 150, width: 300 };

const CLOSERS: Record<string, RegExp> = {
  "-": /-->/gu,
  "?": /\?>/gu,
  "[": /\]\s*>/gu,
};

const UNITS: Record<string, number> = {
  cm: 96 / 2.54,
  in: 96,
  mm: 96 / 25.4,
  pc: 16,
  pt: 4 / 3,
  px: 1,
  q: 96 / 101.6,
};

const rootStart = (text: string): number => {
  const step =
    /\s*(?:(?<root><(?:[\w.-]+:)?svg[\s>])|(?<open><\?|<!--|<!doctype[^>[]*[>[]))/iuy;
  let at = 0;

  for (;;) {
    step.lastIndex = at;
    const { root, open } = step.exec(text)?.groups ?? {};

    if (root !== undefined) {
      return step.lastIndex - root.length;
    }

    if (open === undefined) {
      return -1;
    }

    at = step.lastIndex;
    const close = CLOSERS[open.slice(-1)];

    if (close) {
      close.lastIndex = at;

      if (!close.test(text)) {
        return -1;
      }

      at = close.lastIndex;
    }
  }
};

export const isSvg = (bytes: Uint8Array): boolean =>
  rootStart(textOf(bytes)) !== -1;

export const sniff = (
  bytes: Uint8Array
): { mime: string | null; animated: boolean } => {
  const known = raster(bytes);

  return known.mime === null && isSvg(bytes)
    ? { animated: false, mime: "image/svg+xml" }
    : known;
};

const svgLength = (value = ""): number => {
  let scale = 1;
  const parsed = Number(
    value
      .trim()
      .toLowerCase()
      .replace(/(?:px|in|cm|mm|pt|pc|q)$/u, (unit) => {
        scale = UNITS[unit] ?? 1;

        return "";
      })
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed * scale : 0;
};

const rootTag = (text: string): string => {
  const start = rootStart(text);

  if (start === -1) {
    return "";
  }

  const tag = /<(?:[\w.-]+:)?svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/iuy;

  tag.lastIndex = start;

  return tag.exec(text)?.[0] ?? "";
};

export const svgSize = (text: string): Size => {
  const attributes = new Map(
    [
      ...rootTag(text).matchAll(
        /(?<name>[^\s=]+)\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)')|\S+/gu
      ),
    ].map(({ groups }) => [
      groups?.name?.toLowerCase(),
      groups?.double ?? groups?.single,
    ])
  );
  const [boxWidth = 0, boxHeight = 0] = (attributes.get("viewbox") ?? "")
    .trim()
    .split(/[\s,]+/u)
    .map(Number)
    .slice(2, 4);
  const ratio = boxWidth > 0 && boxHeight > 0 ? boxWidth / boxHeight : 0;
  const width = svgLength(attributes.get("width"));
  const height = svgLength(attributes.get("height"));
  let size = FALLBACK;

  if (width > 0 && height > 0) {
    size = { height, width };
  } else if (width > 0 && ratio > 0) {
    size = { height: width / ratio, width };
  } else if (height > 0 && ratio > 0) {
    size = { height, width: height * ratio };
  } else if (ratio > 0) {
    size = { height: boxHeight, width: boxWidth };
  }

  const area = size.width * size.height;

  return area > 0 && area < Number.POSITIVE_INFINITY ? size : FALLBACK;
};
