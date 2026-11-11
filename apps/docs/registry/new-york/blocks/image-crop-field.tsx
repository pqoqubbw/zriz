"use client";

import type { Cropper as CropperApi, Size } from "@zriz/react";
import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/registry/new-york/ui/button";
import {
  Cropper,
  CropperViewport,
  CropperZoom,
  CropperZoomIn,
  CropperZoomOut,
  cropToFile,
} from "@/registry/new-york/ui/cropper";

type ImageCropFieldProps = {
  aspect?: number;
  className?: string;
  defaultImage?: Blob | string | null;
  description?: string;
  label: string;
  maxSize?: Size;
  name: string;
};

const WIDE = 16 / 9;

const MAX_SIZE: Size = { height: 1600, width: 1600 };

const ImageCropField = ({
  aspect = WIDE,
  className,
  defaultImage = null,
  description = "The crop you see is the file the form sends.",
  label,
  maxSize = MAX_SIZE,
  name,
}: ImageCropFieldProps) => {
  const [image, setImage] = useState<Blob | string | null>(defaultImage);
  const [picks, setPicks] = useState(0);
  const [failed, setFailed] = useState(false);
  const [dropping, setDropping] = useState(false);
  const actions = useRef<CropperApi>(null);
  const field = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const running = useRef<AbortController | null>(null);
  const id = useId();

  useEffect(() => {
    const form = field.current?.form;

    const reset = (): void => {
      running.current?.abort();
      setFailed(false);
      setImage(defaultImage);
      setPicks((count) => count + 1);
    };

    form?.addEventListener("reset", reset);

    return () => {
      form?.removeEventListener("reset", reset);
      running.current?.abort();
    };
  }, [defaultImage]);

  const fill = (files: File[]): void => {
    if (!field.current) {
      return;
    }

    const transfer = new DataTransfer();

    for (const file of files) {
      transfer.items.add(file);
    }

    field.current.files = transfer.files;
  };

  const sync = async (): Promise<void> => {
    if (!actions.current) {
      return;
    }

    running.current?.abort();
    const controller = new AbortController();

    running.current = controller;
    const file = await cropToFile(actions.current, {
      maxSize,
      name,
      quality: 0.9,
      signal: controller.signal,
      type: "image/jpeg",
    }).catch(() => null);

    if (controller.signal.aborted) {
      return;
    }

    setFailed(file === null);

    if (file !== null) {
      fill([file]);
    }
  };

  const open = (file: File | undefined): void => {
    if (file) {
      setFailed(false);
      setImage(file);
      setPicks((count) => count + 1);
    }
  };

  const remove = (): void => {
    running.current?.abort();
    fill([]);
    setFailed(false);
    setImage(null);
    picker.current?.focus();
  };

  const drop = (event: DragEvent): void => {
    event.preventDefault();
    setDropping(false);
    open(event.dataTransfer.files[0]);
  };

  return (
    <div
      className={cn("flex w-full flex-col gap-2", className)}
      data-slot="image-crop-field"
    >
      <label className="text-sm leading-none font-medium" htmlFor={id}>
        {label}
      </label>
      <input hidden name={name} ref={field} type="file" />
      <input
        accept="image/jpeg,image/png,image/webp"
        className="peer sr-only"
        id={id}
        onChange={(event) => {
          open(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
        ref={picker}
        tabIndex={image === null ? 0 : -1}
        type="file"
      />
      {image === null ? (
        <button
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input px-4 text-sm text-muted-foreground outline-none peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-muted/50 data-dropping:border-ring data-dropping:bg-muted/50"
          data-dropping={dropping ? "" : undefined}
          onClick={() => {
            picker.current?.click();
          }}
          onDragLeave={() => {
            setDropping(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDrop={drop}
          style={{ aspectRatio: aspect }}
          tabIndex={-1}
          type="button"
        >
          <span className="font-medium text-foreground">Choose an image</span>
          <span className="text-xs">or drop it here</span>
        </button>
      ) : (
        <Cropper
          actionsRef={actions}
          aspect={aspect}
          className="[--zriz-frame:transparent]"
          key={picks}
          maxZoom={4}
          onError={() => {
            setFailed(true);
          }}
          onLoad={() => {
            void sync();
          }}
          onValueCommit={() => {
            void sync();
          }}
          src={image}
          svg={false}
        >
          <CropperViewport
            className="aspect-auto p-0"
            grid={false}
            handles={false}
            style={{ aspectRatio: aspect }}
            wheel="none"
          />
          <div className="flex items-center gap-1">
            <CropperZoomOut />
            <CropperZoom />
            <CropperZoomIn />
            <Button
              className="ml-2"
              onClick={() => {
                picker.current?.click();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Replace
            </Button>
            <Button onClick={remove} size="sm" type="button" variant="ghost">
              Remove
            </Button>
          </div>
        </Cropper>
      )}
      {failed ? (
        <p className="text-xs text-destructive" role="alert">
          This image did not open. Try a JPEG, PNG or WebP.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

export type { ImageCropFieldProps };
export { ImageCropField };
