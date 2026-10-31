import type { Size } from "../geometry/types";
import { raster } from "./image";

export const sniff = (
  bytes: Uint8Array
): { mime: string | null; animated: boolean } => {
  const known = raster(bytes);
  if (known.mime !== null) {
    return known;
  }
  const text = new TextDecoder().decode(bytes.subarray(0, 512));
  if (
    /^\s*(?:<\?xml[^>]*\?>\s*)?(?:(?:<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)\s*)*<svg[\s>]/iu.test(
      text
    )
  ) {
    return { animated: false, mime: "image/svg+xml" };
  }
  return known;
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
