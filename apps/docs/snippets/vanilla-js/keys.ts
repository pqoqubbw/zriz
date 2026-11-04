import { areaKeyHandlers } from "@zriz/core/dom";
import { cropper } from "./cropper";

const area = document.getElementById("area") as HTMLElement;
const keys = areaKeyHandlers(cropper);

area.onkeydown = keys.onKeyDown;
area.onkeyup = keys.onKeyUp;
area.onblur = keys.onBlur;

export const unbind = () => {
  keys.release();
};
