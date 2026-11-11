const REGISTRY_URL = "https://zriz.dev/r";

const REGISTRY_ITEMS = {
  "avatar-cropper": {
    summary:
      "an avatar with an upload button that opens a dialog with a round crop and a zoom slider",
  },
  "cover-cropper": {
    summary:
      "a wide cover image that the visitor drags into place, with change, reposition, save and cancel buttons",
  },
  cropper: {
    summary:
      "a square cropper with corner handles, a grid and a zoom slider in shadcn styles",
  },
  "image-crop-dialog": {
    summary:
      "a dialog with a cropper, an aspect ratio switch and a rotate button that returns a file",
  },
  "image-crop-field": {
    summary:
      "a form field that crops the chosen image and submits the crop as a file",
  },
  "image-editor": {
    summary:
      "a card with a cropper, a straighten dial, rotate, flip, aspect ratios and reset",
  },
} as const;

type RegistryName = keyof typeof REGISTRY_ITEMS;

export type { RegistryName };
export { REGISTRY_ITEMS, REGISTRY_URL };
