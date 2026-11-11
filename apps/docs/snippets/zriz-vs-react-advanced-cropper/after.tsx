"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

type Props = { src: string; onSave: (photo: Blob) => void };

export const PhotoCropper = ({ src, onSave }: Props) => {
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const actions = useRef<CropperApi>(null);

  const save = async () => {
    if (!actions.current) return;

    try {
      const { blob } = await exportCrop(actions.current, {
        type: "image/jpeg",
        quality: 0.9,
      });

      setProblem("");
      onSave(blob);
    } catch {
      setProblem("This crop did not save. Try again.");
    }
  };

  return (
    <>
      <Cropper.Root
        actionsRef={actions}
        src={src}
        onLoad={() => setReady(true)}
        onError={() => setProblem("This photo does not open.")}
      >
        <Cropper.Viewport
          wheel="zoom"
          rotateGesture={false}
          style={{ maxWidth: 480, height: 360, padding: 24 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area">
            <Cropper.Handle position="top-left" />
            <Cropper.Handle position="top" />
            <Cropper.Handle position="top-right" />
            <Cropper.Handle position="right" />
            <Cropper.Handle position="bottom-right" />
            <Cropper.Handle position="bottom" />
            <Cropper.Handle position="bottom-left" />
            <Cropper.Handle position="left" />
          </Cropper.Area>
        </Cropper.Viewport>
      </Cropper.Root>
      {problem && <p role="alert">{problem}</p>}
      <button type="button" disabled={!ready} onClick={save}>
        Save
      </button>
    </>
  );
};
