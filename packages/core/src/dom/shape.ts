import type { Cropper } from "../cropper";

const shapes = new WeakMap<Cropper, "rect" | "circle">();

const setCropShape = (cropper: Cropper, shape: "rect" | "circle"): void => {
  shapes.set(cropper, shape);
};

const cropShapeOf = (cropper: Cropper): "rect" | "circle" =>
  shapes.get(cropper) ?? "rect";

export { cropShapeOf, setCropShape };
