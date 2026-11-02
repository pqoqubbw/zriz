import { bindDial, bindDialTicks } from "@zriz/core/dom";
import { cleanups, cropper } from "./cropper";

const dial = document.getElementById("dial") as HTMLElement;
const ticks = document.getElementById("ticks") as HTMLElement;

cleanups.push(
  bindDial(cropper, dial),
  bindDialTicks(cropper, ticks)
);
