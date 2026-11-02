import { createCropper } from "@zriz/core";

const cropper = createCropper();
const off = cropper.on("settle", () => {
  console.log("the crop is still");
});
off();
