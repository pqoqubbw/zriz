import type { Point } from "./types";

export type ViewTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type ScreenRect = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type RecentreFrame = {
  rect: ScreenRect;
  view: ViewTransform;
  scale: number;
};

export type RecentrePlan = {
  factor: number;
  center: Point;
  at: (lambda: number) => RecentreFrame;
  origin: Point | null;
};

export const recentrePlan = (
  rect: ScreenRect,
  view: ViewTransform,
  target: ScreenRect
): RecentrePlan => {
  const factor = Math.min(
    target.width / rect.width,
    target.height / rect.height
  );
  const center = {
    x: (rect.centerX - view.translateX) / view.scale,
    y: (rect.centerY - view.translateY) / view.scale,
  };

  const at = (lambda: number): RecentreFrame => {
    const sigma = 1 + (factor - 1) * lambda;
    const centerX = rect.centerX + (target.centerX - rect.centerX) * lambda;
    const centerY = rect.centerY + (target.centerY - rect.centerY) * lambda;
    const scale = view.scale * sigma;

    return {
      rect: {
        centerX,
        centerY,
        height: rect.height * sigma,
        width: rect.width * sigma,
      },
      scale: sigma,
      view: {
        scale,
        translateX: centerX - scale * center.x,
        translateY: centerY - scale * center.y,
      },
    };
  };

  const origin =
    factor === 1
      ? null
      : {
          x: (target.centerX - factor * rect.centerX) / (1 - factor),
          y: (target.centerY - factor * rect.centerY) / (1 - factor),
        };

  return { at, center, factor, origin };
};

export const anchoredZoom = (
  center: Point,
  scale: number,
  nextScale: number,
  focus: Point
): Point => ({
  x: center.x + focus.x * (1 / scale - 1 / nextScale),
  y: center.y + focus.y * (1 / scale - 1 / nextScale),
});
