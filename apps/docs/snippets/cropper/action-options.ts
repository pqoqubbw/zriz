import { createCropper } from "@zriz/core";

const cropper = createCropper({
  image: { width: 4032, height: 3024 },
  onValueCommit: (value, details) => {
    console.log(value.rotation, details.reason);
  },
});

cropper.setRotation(5, { reason: "history" });
