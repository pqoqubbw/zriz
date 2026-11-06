import { createCropper } from "@zriz/core";

const cropper = createCropper({
  image: { width: 4032, height: 3024 },
});

cropper.setValue({ rotation: 90 });
cropper.getValue().rotation; // 45
