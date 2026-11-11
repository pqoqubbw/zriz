"use client";

import type { ExportOptions } from "@zriz/core/dom";
import type { Aspect, Cropper as CropperApi } from "@zriz/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/registry/new-york/ui/button";
import {
  Cropper,
  CropperAspect,
  CropperAspectItem,
  CropperRotate,
  CropperViewport,
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

type CropAspect = {
  label: string;
  value: Aspect;
};

type ImageCropDialogProps = {
  aspects?: readonly CropAspect[];
  description?: string;
  exportOptions?: ExportOptions;
  image: Blob | string | null;
  onCrop: (file: File) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title?: string;
};

type ImageCropProps = Pick<
  ImageCropDialogProps,
  "exportOptions" | "image" | "onCrop" | "onOpenChange"
> & {
  aspects: readonly CropAspect[];
};

type Status = "failed" | "loading" | "ready";

const ASPECTS: readonly CropAspect[] = [
  { label: "Free", value: "free" },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

const ImageCrop = ({
  aspects,
  exportOptions,
  image,
  onCrop,
  onOpenChange,
}: ImageCropProps) => {
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
    if (!actions.current) {
      return;
    }

    setSaving(true);
    const file = await cropToFile(actions.current, exportOptions).catch(
      () => null
    );

    if (!open.current) {
      return;
    }

    setSaving(false);
    setUnsaved(file === null);

    if (file !== null) {
      onCrop(file);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Cropper
        actionsRef={actions}
        defaultValue={{ aspect: aspects[0]?.value ?? "free" }}
        onError={() => {
          setStatus("failed");
        }}
        onLoad={() => {
          setStatus("ready");
        }}
        src={image}
      >
        <CropperViewport className="aspect-[3/2]" />
        <div className="flex items-center justify-between gap-2">
          {aspects.length > 1 ? (
            <CropperAspect>
              {aspects.map((aspect) => (
                <CropperAspectItem key={aspect.label} value={aspect.value}>
                  {aspect.label}
                </CropperAspectItem>
              ))}
            </CropperAspect>
          ) : (
            <span />
          )}
          <CropperRotate />
        </div>
      </Cropper>
      {status === "failed" ? (
        <p className="text-sm text-destructive" role="alert">
          This image did not open. Try a JPEG, PNG or WebP.
        </p>
      ) : null}
      {unsaved ? (
        <p className="text-sm text-destructive" role="alert">
          This crop did not save. Try again.
        </p>
      ) : null}
      <DialogFooter>
        <Button
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          disabled={status !== "ready" || saving}
          onClick={() => {
            void save();
          }}
          type="button"
        >
          Crop
        </Button>
      </DialogFooter>
    </>
  );
};

const ImageCropDialog = ({
  aspects = ASPECTS,
  description = "Drag the corners or move the image under the frame.",
  exportOptions,
  image,
  onCrop,
  onOpenChange,
  open,
  title = "Crop image",
}: ImageCropDialogProps) => (
  <Dialog
    onOpenChange={(next: boolean) => {
      onOpenChange(next);
    }}
    open={open}
  >
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <ImageCrop
        aspects={aspects}
        image={image}
        onCrop={onCrop}
        onOpenChange={onOpenChange}
        {...(exportOptions ? { exportOptions } : null)}
      />
    </DialogContent>
  </Dialog>
);

export type { CropAspect, ImageCropDialogProps };
export { ImageCropDialog };
