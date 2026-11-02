"use client";

import type {
  CommitDetails,
  Cropper as CropperApi,
  CropValue,
} from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

const skipped = new Set(["history", "coverage"]);

export const UndoEditor = ({ src }: { src: string }) => {
  const actions = useRef<CropperApi>(null);
  const [history, setHistory] = useState<CropValue[]>([]);

  const remember = (_: CropValue, details: CommitDetails) => {
    if (skipped.has(details.reason)) return;
    setHistory((stack) =>
      [...stack, details.previous].slice(-50)
    );
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    actions.current?.setValue(previous, { reason: "history" });
  };

  return (
    <Cropper.Root
      actionsRef={actions}
      src={src}
      onLoad={() => setHistory([])}
      onValueCommit={remember}
    >
      <Cropper.Viewport style={{ width: 640, height: 480 }}>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
      <Cropper.Dial
        aria-label="Straighten"
        style={{ width: 361 }}
      >
        <Cropper.DialTicks />
      </Cropper.Dial>
      <button
        type="button"
        disabled={history.length === 0}
        onClick={undo}
      >
        undo
      </button>
    </Cropper.Root>
  );
};
