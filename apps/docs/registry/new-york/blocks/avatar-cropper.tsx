"use client";

import type { Cropper as CropperApi, CropValue } from "@zriz/react";
import { useEffect, useRef, useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/new-york/ui/dialog";

type AvatarCropperProps = {
  className?: string;
  defaultImage?: Blob | string | null;
  onCrop?: (file: File) => void;
  size?: number;
};

type AvatarCropProps = {
  defaultValue: CropValue | null;
  image: Blob | string;
  onCancel: () => void;
  onSave: (file: File, value: CropValue) => void;
  size: number;
};

type Status = "failed" | "loading" | "ready";

const AvatarCrop = ({
  defaultValue,
  image,
  onCancel,
  onSave,
  size,
}: AvatarCropProps) => {
  const [status, setStatus] = useState<Status>("loading");
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const actions = useRef<CropperApi>(null);
  const open = useRef(true);

  useEffect(() => {
    open.current = true;

    return () => {
      open.current = false;
    };
  }, []);

  const save = async (): Promise<void> => {
    const cropper = actions.current;

    if (!cropper) {
      return;
    }

    setSaving(true);
    const file = await cropToFile(cropper, {
      maxSize: { height: size, width: size },
      name: "avatar",
    }).catch(() => null);

    if (!open.current) {
      return;
    }

    setSaving(false);
    setUnsaved(file === null);

    if (file !== null) {
      onSave(file, cropper.getValue());
    }
  };

  return (
    <>
      <Cropper
        actionsRef={actions}
        maxZoom={4}
        onError={() => {
          setStatus("failed");
        }}
        onLoad={() => {
          setStatus("ready");
        }}
        shape="circle"
        src={image}
        svg={false}
        {...(defaultValue === null ? null : { defaultValue })}
      >
        <CropperViewport
          className="aspect-[3/2] p-4"
          grid={false}
          handles={false}
          wheel="zoom"
        />
        <div className="flex items-center gap-1">
          <CropperZoomOut />
          <CropperZoom />
          <CropperZoomIn />
        </div>
      </Cropper>
      {status === "failed" ? (
        <p className="text-sm text-destructive" role="alert">
          This photo did not open. Try a JPEG, PNG or WebP.
        </p>
      ) : null}
      {unsaved ? (
        <p className="text-sm text-destructive" role="alert">
          This crop did not save. Try again.
        </p>
      ) : null}
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={status !== "ready" || saving}
          onClick={() => {
            void save();
          }}
          type="button"
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
};

const AvatarCropper = ({
  className,
  defaultImage = null,
  onCrop,
  size = 512,
}: AvatarCropperProps) => {
  const [image, setImage] = useState<Blob | string | null>(defaultImage);
  const [draft, setDraft] = useState<Blob | string | null>(defaultImage);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<CropValue | null>(null);
  const [preview, setPreview] = useState<string | null>(
    typeof defaultImage === "string" ? defaultImage : null
  );
  const made = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (made.current !== null) {
        URL.revokeObjectURL(made.current);
      }
    },
    []
  );

  const edit = (next: Blob | string): void => {
    setDraft(next);
    setOpen(true);
  };

  const save = (file: File, next: CropValue): void => {
    const url = URL.createObjectURL(file);

    if (made.current !== null) {
      URL.revokeObjectURL(made.current);
    }

    made.current = url;
    setPreview(url);
    setValue(next);
    setImage(draft);
    setOpen(false);
    onCrop?.(file);
  };

  return (
    <div
      className={cn("flex items-center gap-4", className)}
      data-slot="avatar-cropper"
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10">
        {preview === null ? (
          <svg
            aria-hidden="true"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 20 20"
          >
            <path d="M13 7A3 3 0 1 1 7 7A3 3 0 1 1 13 7Z" />
            <path d="M4 16.5A6 6 0 0 1 16 16.5" />
          </svg>
        ) : (
          <span
            aria-hidden="true"
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url(${preview})` }}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              input.current?.click();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Upload photo
          </Button>
          {image === null ? null : (
            <Button
              onClick={() => {
                edit(image);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Adjust
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG or WebP.</p>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Upload photo"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          event.currentTarget.value = "";

          if (file) {
            edit(file);
          }
        }}
        ref={input}
        tabIndex={-1}
        type="file"
      />
      <Dialog
        onOpenChange={(next: boolean) => {
          setOpen(next);
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop your photo</DialogTitle>
            <DialogDescription>
              Drag to move. Pinch or scroll to zoom.
            </DialogDescription>
          </DialogHeader>
          {draft === null ? null : (
            <AvatarCrop
              defaultValue={draft === image ? value : null}
              image={draft}
              onCancel={() => {
                setOpen(false);
              }}
              onSave={save}
              size={size}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export type { AvatarCropperProps };
export { AvatarCropper };
