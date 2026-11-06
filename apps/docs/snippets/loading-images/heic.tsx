"use client";

import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useEffect, useRef, useState } from "react";
import { open } from "./decoder";

type Props = { onSave: (cropper: CropperApi) => void };

export const Heic = ({ onSave }: Props) => {
  const cropper = useRef<CropperApi>(null);
  const last = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => last.current?.abort(), []);

  return (
    <>
      <input
        type="file"
        accept="image/*,.heic"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (!file || !cropper.current) return;
          last.current?.abort();
          const controller = new AbortController();

          last.current = controller;
          setReady(false);
          setFailed(false);

          open(cropper.current, file, controller.signal).then(
            () => setReady(true),
            () => {
              if (!controller.signal.aborted) setFailed(true);
            }
          );
        }}
      />
      <Cropper.Root actionsRef={cropper}>
        <Cropper.Viewport style={{ width: 480, height: 360 }}>
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      <button
        type="button"
        disabled={!ready}
        onClick={() =>
          cropper.current && onSave(cropper.current)
        }
      >
        save
      </button>
      {failed && (
        <p role="alert">this photo does not open here.</p>
      )}
    </>
  );
};
