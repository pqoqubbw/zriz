"use client";

import type { ZrizError } from "@zriz/core/dom";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import { ERROR_MS, SPINNER_DELAY_MS } from "@/demos/shell/sizes";

type PhotoStatus = "empty" | "first" | "ready" | "replacing";

type PhotoDrop = {
  onDragEnter: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

type PhotoEvents = {
  check: boolean;
  onCancel: () => void;
  onOpen: () => void;
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
  replacing: boolean;
  ready: boolean;
  src: Blob | string;
};

const NOT_AN_IMAGE = "Not an image";

const UNREADABLE = "Can’t read this file";

const ERROR_TEXT: Partial<Record<ZrizError["code"], string>> = {
  blank: UNREADABLE,
  "cross-origin": "Can’t open this link",
  decode: UNREADABLE,
  timeout: "Can’t open this link",
  "too-large": "Too large",
  "unsupported-format": NOT_AN_IMAGE,
};

const readable = async (file: File): Promise<boolean> => {
  try {
    const bitmap = await createImageBitmap(file);

    bitmap.close();

    return true;
  } catch {
    return false;
  }
};

const hasFiles = (event: DragEvent): boolean =>
  event.dataTransfer.types.includes("Files");

const usePhoto = (
  initial: string,
  { check, onCancel, onOpen }: PhotoEvents
): Photo => {
  const [src, setSrc] = useState<Blob | string>(initial);
  const [status, setStatus] = useState<PhotoStatus>("first");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);
  const [pick, setPick] = useState(0);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const wait =
      status === "first"
        ? setTimeout(() => {
            setSlow(true);
          }, SPINNER_DELAY_MS)
        : undefined;

    return () => {
      clearTimeout(wait);
    };
  }, [status]);

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

    const swap = (): void => {
      setSrc(file);
      setPick((count) => count + 1);
    };

    show(null);
    onOpen();
    setStatus(loaded ? "replacing" : "first");

    if (!check) {
      swap();

      return;
    }

    void readable(file).then((ok) => {
      if (ok) {
        swap();
      } else {
        onCancel();
        setStatus(loaded ? "ready" : "empty");
        show(UNREADABLE);
      }

      return ok;
    });
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
      setStatus(loaded ? "ready" : "empty");

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
    loading: status === "replacing" || (status === "first" && slow),
    pick,
    ready: loaded && status === "ready",
    replacing: status === "replacing",
    src,
  };
};

export type { Photo, PhotoDrop, PhotoEvents };
export { usePhoto };
