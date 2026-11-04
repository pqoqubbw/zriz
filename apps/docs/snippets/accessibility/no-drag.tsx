"use client";

import { useCropper } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";

export const Editor = ({ src }: { src: string }) => {
  const cropper = useCropper();
  const turn = (by: number) => {
    cropper.setRotation(cropper.getValue().rotation + by, {
      reason: "keyboard",
    });
  };
  const move = (x: number, y: number) => {
    cropper.panBy(x, y, { reason: "keyboard" });
  };
  const resize = (by: number) => {
    const state = cropper.getCropState();
    if (state) {
      const crop = {
        ...state.crop,
        height: state.crop.height * by,
        width: state.crop.width * by,
      };
      cropper.setCropState(
        { ...state, crop },
        { keep: "centre", reason: "keyboard" }
      );
    }
  };
  return (
    <>
      <Cropper.Root cropper={cropper} src={src}>
        <Cropper.Viewport style={{ width: 480, height: 360 }}>
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      <button onClick={() => turn(-1)}>straighten left</button>
      <button onClick={() => turn(1)}>straighten right</button>
      <button onClick={() => move(-0.01, 0)}>move left</button>
      <button onClick={() => move(0.01, 0)}>move right</button>
      <button onClick={() => move(0, -0.01)}>move up</button>
      <button onClick={() => move(0, 0.01)}>move down</button>
      <button onClick={() => resize(0.9)}>smaller crop</button>
      <button onClick={() => resize(1.1)}>larger crop</button>
    </>
  );
};
