"use client";

import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useRef, useState } from "react";

const unreadable =
  "this photo does not open. pick a jpeg, png, webp or avif.";

export const CropUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState(0);
  const actions = useRef<CropperApi>(null);

  const upload = async () => {
    const plan = actions.current?.getPixelCrop();
    if (!file || !plan) return;
    const form = new FormData();
    form.append("file", file);
    form.append("plan", JSON.stringify(plan));
    const response = await fetch("/api/crop", {
      method: "POST",
      body: form,
    }).catch(() => null);
    if (!response) {
      setError("the upload did not reach the server.");
      return;
    }
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    if (result) URL.revokeObjectURL(result);
    setError(null);
    setResult(URL.createObjectURL(await response.blob()));
  };

  return (
    <>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => {
          setReady(false);
          setError(null);
          if (result) URL.revokeObjectURL(result);
          setResult(null);
          setPicks((count) => count + 1);
          setFile(event.target.files?.[0] ?? null);
        }}
      />
      <Cropper.Root
        key={picks}
        actionsRef={actions}
        src={file}
        onLoad={() => setReady(true)}
        onError={() => setError(unreadable)}
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
      </Cropper.Root>
      <button type="button" disabled={!ready} onClick={upload}>
        upload
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <img src={result} alt="Crop from the server" />
      )}
    </>
  );
};
