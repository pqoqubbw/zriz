"use client";

import type { ZrizError } from "@zriz/core/dom";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import { ERROR_MS } from "@/demos/shell/sizes";

type PhotoStatus = "first" | "ready" | "replacing";

type PhotoDrop = {
  onDragEnter: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

type Photo = {
  drop: PhotoDrop;
  dropping: boolean;
  error: string | null;
  handleError: (error: ZrizError) => void;
  handleLoad: () => void;
  handlePick: (event: ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  pick: number;
  ready: boolean;
  src: Blob | string;
};

const NOT_AN_IMAGE = "not an image";

const ERROR_TEXT: Partial<Record<ZrizError["code"], string>> = {
  blank: "can’t read this file",
  "cross-origin": "can’t open this link",
  decode: "can’t read this file",
  timeout: "can’t open this link",
  "too-large": "too large",
  "unsupported-format": NOT_AN_IMAGE,
};

const hasFiles = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes("Files");

const usePhoto = (initial: string, onOpen: () => void): Photo => {
  const [src, setSrc] = useState<Blob | string>(initial);
  const [status, setStatus] = useState<PhotoStatus>("first");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);
  const [pick, setPick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    []
  );

  const show = (text: string | null): void => {
    clearTimeout(timer.current);
    setError(text);

    if (text !== null) {
      timer.current = setTimeout(() => {
        setError(null);
      }, ERROR_MS);
    }
  };

  const open = (file: File | undefined): void => {
    if (!file) {
      return;
    }

    if (file.type !== "" && !file.type.startsWith("image/")) {
      show(NOT_AN_IMAGE);

      return;
    }

    show(null);
    onOpen();
    setSrc(file);
    setPick((count) => count + 1);
    setStatus(loaded ? "replacing" : "first");
  };

  return {
    drop: {
      onDragEnter: (event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          setDepth((count) => count + 1);
        }
      },
      onDragLeave: (event) => {
        if (hasFiles(event)) {
          setDepth((count) => Math.max(0, count - 1));
        }
      },
      onDragOver: (event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      },
      onDrop: (event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          setDepth(0);
          open(event.dataTransfer.files[0]);
        }
      },
    },
    dropping: depth > 0,
    error,
    handleError: (failure) => {
      setStatus(loaded ? "ready" : "first");

      const text = ERROR_TEXT[failure.code];

      if (text !== undefined) {
        show(text);
      }
    },
    handleLoad: () => {
      setLoaded(true);
      setStatus("ready");
    },
    handlePick: (event) => {
      open(event.currentTarget.files?.[0]);
      event.currentTarget.value = "";
    },
    loading: status === "replacing",
    pick,
    ready: loaded && status === "ready",
    src,
  };
};

export type { Photo, PhotoDrop };
export { usePhoto };
