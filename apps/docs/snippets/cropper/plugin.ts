import { createCropper } from "@zriz/core";
import type { CropperPlugin } from "@zriz/core";

let off = () => {};

const logger: CropperPlugin = {
  name: "logger",
  init: (cropper) => {
    off = cropper.on("commit", (value) => console.log(value));
  },
  destroy: () => off(),
};

const cropper = createCropper({ plugins: [logger] });
cropper.destroy();
