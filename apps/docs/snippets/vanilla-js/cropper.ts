import { createCropper } from "@zriz/core";
import {
  attachImage,
  bindArea,
  bindHandle,
  bindMask,
  bindPhoto,
  bindState,
  bindViewport,
  loadImage,
} from "@zriz/core/dom";
import "@zriz/core/styles.css";

const byId = (id: string) =>
  document.getElementById(id) as HTMLElement;

export const cropper = createCropper({
  defaultValue: { aspect: 4 / 3 },
});

export const cleanups = [
  bindState(cropper, byId("cropper")),
  bindViewport(cropper, byId("viewport")),
  bindPhoto(cropper, byId("photo")),
  bindMask(cropper, byId("mask")),
  bindArea(cropper, byId("area")),
];

const corners = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
for (const corner of corners) {
  const handle = document.createElement("div");
  handle.dataset.zrizItem = "handle";
  handle.setAttribute("aria-hidden", "true");
  byId("area").append(handle);
  cleanups.push(bindHandle(cropper, handle, corner));
}

byId("file").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    attachImage(cropper, await loadImage(file));
  } catch {
    byId("status").textContent = "this photo does not open.";
  }
});
