import { createCropper } from "@zriz/core";

const cropper = createCropper({
  image: { width: 4032, height: 3024 },
});
const owner = {};

export const bind = (input: HTMLInputElement) => {
  input.addEventListener("pointerdown", (event) => {
    cropper.begin("dial", event, owner);
  });
  input.addEventListener("input", () => {
    cropper.setRotation(input.valueAsNumber);
  });
  const end = (event: PointerEvent) => {
    cropper.end(event, owner);
  };
  input.addEventListener("pointerup", end);
  input.addEventListener("pointercancel", end);
};
