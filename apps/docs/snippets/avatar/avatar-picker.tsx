"use client";

import { exportCrop } from "@zriz/core/dom";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useRef, useState } from "react";

type Props = { onSave: (png: Blob) => void };
type Status = "empty" | "ready" | "failed";

const unreadable =
  "this photo does not open. pick a jpeg, png or webp.";
const unsaved = "this crop did not save. try again.";

export const AvatarPicker = ({ onSave }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("empty");
  const [saveFailed, setSaveFailed] = useState(false);
  const [picks, setPicks] = useState(0);
  const [saving, setSaving] = useState(false);
  const actions = useRef<CropperApi>(null);
  const running = useRef<AbortController | null>(null);

  useEffect(() => () => running.current?.abort(), [picks]);

  const save = async () => {
    if (!actions.current || running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setSaving(true);
    try {
      const { blob } = await exportCrop(actions.current, {
        maxSize: { width: 512, height: 512 },
        signal: controller.signal,
      });
      setSaveFailed(false);
      onSave(blob);
    } catch {
      setSaveFailed(!controller.signal.aborted);
    } finally {
      running.current = null;
      setSaving(false);
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={(event) => {
          setStatus("empty");
          setSaveFailed(false);
          setPicks((count) => count + 1);
          setFile(event.target.files?.[0] ?? null);
        }}
      />
      <Cropper.Root
        key={picks}
        actionsRef={actions}
        src={file}
        svg={false}
        shape="circle"
        minSize={{ width: 512, height: 512 }}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("failed")}
      >
        <Cropper.Viewport
          wheel="zoom"
          style={{ width: 320, height: 320 }}
        >
          <Cropper.Image />
          <Cropper.Mask />
          <Cropper.Area aria-label="Crop area" />
        </Cropper.Viewport>
      </Cropper.Root>
      {status === "failed" && <p role="alert">{unreadable}</p>}
      {saveFailed && <p role="alert">{unsaved}</p>}
      <button
        type="button"
        disabled={status !== "ready"}
        aria-disabled={saving}
        onClick={save}
      >
        save
      </button>
    </>
  );
};
