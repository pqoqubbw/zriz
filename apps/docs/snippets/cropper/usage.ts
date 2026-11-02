import { createCropper } from "@zriz/core";

const cropper = createCropper({
  image: { width: 4032, height: 3024 },
});
cropper.setRotation(7);
