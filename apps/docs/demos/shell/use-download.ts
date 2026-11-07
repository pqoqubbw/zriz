"use client";

import type { Cropper } from "@zriz/core";
import { exportCrop } from "@zriz/core/dom";
import type { ExportOptions } from "@zriz/core/dom";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

type DemoRun = (cropper: Cropper, signal: AbortSignal) => Promise<void>;

type Download = {
  abort: () => void;
  busy: boolean;
  run: () => Promise<void>;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const REVOKE_MS = 1000;

const save = (blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `zriz-crop.${EXTENSIONS[blob.type] ?? "png"}`;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_MS);
};

const exportRun =
  (options: ExportOptions | undefined): DemoRun =>
  async (cropper, signal) => {
    const { blob } = await exportCrop(cropper, { ...options, signal });

    if (!signal.aborted) {
      save(blob);
    }
  };

const attempt = async (
  run: DemoRun,
  cropper: Cropper,
  signal: AbortSignal
): Promise<boolean> => {
  try {
    await run(cropper, signal);

    return !signal.aborted;
  } catch {
    return false;
  }
};

const useDownload = (
  actions: RefObject<Cropper | null>,
  run: DemoRun
): Download => {
  const running = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      running.current?.abort();
    },
    []
  );

  return {
    abort: () => {
      running.current?.abort();
    },
    busy,
    run: async () => {
      const cropper = actions.current;

      if (!cropper || running.current) {
        return;
      }

      const controller = new AbortController();

      running.current = controller;
      setBusy(true);

      await attempt(run, cropper, controller.signal);

      running.current = null;
      setBusy(false);
    },
  };
};

export type { DemoRun, Download };
export { exportRun, useDownload };
