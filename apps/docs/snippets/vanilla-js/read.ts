import { cropper } from "./cropper";

cropper.on("commit", (value, details) => {
  console.log(value.size, details.pixelCrop);
});
