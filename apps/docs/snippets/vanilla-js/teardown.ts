import { attachImage } from "@zriz/core/dom";
import { cleanups, cropper } from "./cropper";

for (const cleanup of cleanups) cleanup();
attachImage(cropper, null);
cropper.destroy();
