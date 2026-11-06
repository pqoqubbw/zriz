"use client";

import { serialize } from "@zriz/core";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useRef, useState } from "react";
import { MAX_ZOOM, MIN_SIZE } from "./crop-limits";

const unreadable =
  "this photo does not open. pick a jpeg, png, webp or avif.";

export const CropUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState(0);
  const actions = useRef<CropperApi>(null);
  const last = useRef<AbortController | null>(null);

  useEffect(() => () => last.current?.abort(), []);

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result);
    },
    [result]
  );

  const upload = async () => {
    const value = actions.current?.getValue();

    if (!file || !value) return;
    last.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;

    last.current = controller;
    setError(null);
    setResult(null);
    const form = new FormData();

    form.append("file", file);
    form.append("value", serialize(value));

    try {
      const response = await fetch("/api/crop", {
        method: "POST",
        body: form,
        signal,
      });

      if (response.ok) {
        const blob = await response.blob();

        if (!signal.aborted) {
          setResult(URL.createObjectURL(blob));
        }
      } else {
        const message = await response.text();

        if (!signal.aborted) setError(message);
      }
    } catch {
      if (!signal.aborted) {
        setError("the upload did not reach the server.");
      }
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={(event) => {
          last.current?.abort();
          setReady(false);
          setError(null);
          setResult(null);
          setPicks((count) => count + 1);
          setFile(event.target.files?.[0] ?? null);
        }}
      />
      <Cropper.Root
        key={picks}
        actionsRef={actions}
        maxZoom={MAX_ZOOM}
        minSize={MIN_SIZE}
        src={file}
        svg={false}
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
