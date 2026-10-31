import type { Cropper } from "../cropper";

const shapes = new WeakMap<Cropper, "rect" | "circle">();

export const setCropShape = (
  cropper: Cropper,
  shape: "rect" | "circle"
): void => {
  shapes.set(cropper, shape);
};

export const cropShapeOf = (cropper: Cropper): "rect" | "circle" =>
  shapes.get(cropper) ?? "rect";
