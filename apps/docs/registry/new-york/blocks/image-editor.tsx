"use client";

import type { ExportOptions } from "@zriz/core/dom";
import type { Cropper as CropperApi, CropValue } from "@zriz/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/registry/new-york/ui/button";
import {
  Cropper,
  CropperAngle,
  CropperAspect,
  CropperAspectItem,
  CropperDial,
  CropperFlip,
  CropperReset,
  CropperRotate,
  CropperViewport,
  cropToFile,
} from "@/registry/new-york/ui/cropper";

type ImageEditorProps = {
  className?: string;
  defaultValue?: Partial<CropValue>;
  exportOptions?: ExportOptions;
  image: Blob | string | null;
  onCancel?: () => void;
  onSave: (file: File, value: CropValue) => void;
};

type Status = "failed" | "loading" | "ready";

const ImageEditor = ({
  className,
  defaultValue,
  exportOptions,
  image,
  onCancel,
  onSave,
}: ImageEditorProps) => {
  const [status, setStatus] = useState<Status>("loading");
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const actions = useRef<CropperApi>(null);

  const save = async (): Promise<void> => {
    const cropper = actions.current;

    if (!cropper) {
      return;
    }

    setSaving(true);
    const file = await cropToFile(cropper, exportOptions).catch(() => null);

    setSaving(false);
    setUnsaved(file === null);

    if (file !== null) {
      onSave(file, cropper.getValue());
    }
  };

  return (
    <div
      className={cn(
        "flex w-full max-w-md flex-col gap-4 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10",
        className
      )}
      data-slot="image-editor"
    >
      <Cropper
        actionsRef={actions}
        onError={() => {
          setStatus("failed");
        }}
        onLoad={() => {
          setStatus("ready");
        }}
        src={image}
        {...(defaultValue ? { defaultValue } : null)}
      >
        <CropperViewport className="aspect-[4/3]" />
        <div className="flex items-end gap-1">
          <CropperRotate className="mb-2" />
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <CropperAngle />
            <CropperDial className="w-full flex-none" />
          </div>
          <CropperFlip className="mb-2" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CropperAspect>
            <CropperAspectItem value="free">Free</CropperAspectItem>
            <CropperAspectItem value="original">Original</CropperAspectItem>
            <CropperAspectItem value={1}>1:1</CropperAspectItem>
            <CropperAspectItem value={4 / 3}>4:3</CropperAspectItem>
            <CropperAspectItem value={16 / 9}>16:9</CropperAspectItem>
          </CropperAspect>
          <CropperReset />
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
      <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        ) : null}
        <Button
          disabled={status !== "ready" || saving}
          onClick={() => {
            void save();
          }}
          type="button"
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export type { ImageEditorProps };
export { ImageEditor };
