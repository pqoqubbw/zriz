import {
  bindZoomThumb,
  zoomAria,
  zoomHandlers,
} from "@zriz/core/dom";
import { cleanups, cropper } from "./cropper";

const zoom = document.getElementById("zoom") as HTMLElement;
const thumb = document.getElementById("thumb") as HTMLElement;
const handlers = zoomHandlers(cropper);

zoom.onpointerdown = handlers.onPointerDown;
zoom.onpointermove = handlers.onPointerMove;
zoom.onpointerup = handlers.onPointerUp;
zoom.onpointercancel = handlers.onPointerCancel;
zoom.onlostpointercapture = handlers.onLostPointerCapture;
zoom.onkeydown = handlers.onKeyDown;
zoom.onkeyup = handlers.onKeyUp;
zoom.onblur = handlers.onBlur;

cleanups.push(
  zoomAria(cropper, zoom),
  bindZoomThumb(cropper, thumb)
);
