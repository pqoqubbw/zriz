"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useRef, useState } from "react";

const aspects = [
  { label: "Free", value: "free" },
  { label: "Original", value: "original" },
  { label: "Square", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
] as const;

const Editor = () => {
  const actions = useRef<CropperApi>(null);
  const [result, setResult] = useState<string | null>(null);
  const save = async () => {
    if (!actions.current) {
      return;
    }
    const { blob } = await exportCrop(actions.current, { type: "image/jpeg" });
    setResult((previous) => {
      if (previous !== null) {
        URL.revokeObjectURL(previous);
      }
      return URL.createObjectURL(blob);
    });
  };
  return (
    <div className="editor-demo">
      <Cropper.Root actionsRef={actions} src="/sunset.jpg">
        <Cropper.Viewport className="editor-viewport">
          <Cropper.Image alt="" />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area">
            <Cropper.Grid />
            {(
              [
                "top-left",
                "top",
                "top-right",
                "right",
                "bottom-right",
                "bottom",
                "bottom-left",
                "left",
              ] as const
            ).map((position) => (
              <Cropper.Handle key={position} position={position} />
            ))}
          </Cropper.Area>
        </Cropper.Viewport>
        <Cropper.Instructions>
          Drag the photo to move it. Arrow keys move it too, Alt with an arrow
          resizes, plus and minus zoom.
        </Cropper.Instructions>
        <div className="editor-dial">
          <Cropper.DialValue className="editor-angle" />
          <Cropper.Dial aria-label="Straighten" className="editor-ruler">
            <Cropper.DialTicks />
          </Cropper.Dial>
        </div>
        <div className="editor-bar">
          <Cropper.AspectGroup aria-label="Aspect" className="editor-aspects">
            {aspects.map((aspect) => (
              <Cropper.AspectItem key={aspect.label} value={aspect.value}>
                {aspect.label}
              </Cropper.AspectItem>
            ))}
          </Cropper.AspectGroup>
          <Cropper.Rotate aria-label="Rotate left">Rotate</Cropper.Rotate>
          <Cropper.Flip aria-label="Flip">Flip</Cropper.Flip>
          <Cropper.Reset>Reset</Cropper.Reset>
          <button
            onClick={() => {
              void save();
            }}
            type="button"
          >
            Export
          </button>
        </div>
      </Cropper.Root>
      {result === null ? null : (
        <img alt="Exported crop" className="editor-result" src={result} />
      )}
    </div>
  );
};

export default Editor;
