"use client";

import { attachImage } from "@zriz/core/dom";
import { useCropper } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useEffect } from "react";

export const Editor = ({ src }: { src: string }) => {
  const cropper = useCropper();

  useEffect(() => () => attachImage(cropper, null), [cropper]);

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
        { keep: "center", reason: "keyboard" }
      );
    }
  };

  return (
    <>
      <Cropper.Root cropper={cropper} src={src}>
        <Cropper.Viewport
          style={{ maxWidth: 480, height: 360 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      <button onClick={() => turn(-1)}>Straighten left</button>
      <button onClick={() => turn(1)}>Straighten right</button>
      <button onClick={() => move(-0.01, 0)}>Move left</button>
      <button onClick={() => move(0.01, 0)}>Move right</button>
      <button onClick={() => move(0, -0.01)}>Move up</button>
      <button onClick={() => move(0, 0.01)}>Move down</button>
      <button onClick={() => resize(0.9)}>Smaller crop</button>
      <button onClick={() => resize(1.1)}>Larger crop</button>
    </>
  );
};
