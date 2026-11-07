"use client";

import type {
  CommitDetails,
  Cropper as CropperApi,
  CropValue,
} from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";
import "./undo.css";

const skipped = new Set(["history", "coverage"]);

const Editor = ({ src }: { src: string }) => {
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

    if (!previous || actions.current?.getState().interacting) {
      return;
    }

    setHistory(history.slice(0, -1));
    actions.current?.setValue(previous, { reason: "history" });
  };

  return (
    <Cropper.Root
      actionsRef={actions}
      src={src}
      onValueCommit={remember}
    >
      <Cropper.Viewport style={{ maxWidth: 640, height: 480 }}>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
      <Cropper.Dial
        aria-label="Straighten"
        style={{ maxWidth: 361 }}
      >
        <Cropper.DialTicks />
      </Cropper.Dial>
      <button
        type="button"
        className="undo"
        aria-disabled={history.length === 0}
        onClick={undo}
      >
        undo
      </button>
    </Cropper.Root>
  );
};

export const UndoEditor = ({ src }: { src: string }) => (
  <Editor key={src} src={src} />
);
