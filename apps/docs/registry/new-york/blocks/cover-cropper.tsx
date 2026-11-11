"use client";

import type { Cropper as CropperApi, CropValue } from "@zriz/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/registry/new-york/ui/button";
import {
  Cropper,
  CropperViewport,
  CropperZoom,
  cropToFile,
} from "@/registry/new-york/ui/cropper";

type CoverCropperProps = {
  aspect?: number;
  className?: string;
  defaultImage?: Blob | string | null;
  onCrop?: (file: File) => void;
  width?: number;
};

type Mode = "edit" | "loading" | "view";

type Problem = "open" | "save" | null;

type Saved = {
  image: Blob | string | null;
  value: CropValue | null;
};

const PROBLEMS = {
  open: "This image did not open. Try a JPEG, PNG or WebP.",
  save: "This cover did not save. Try again.",
} as const;

const CoverCropper = ({
  aspect = 3,
  className,
  defaultImage = null,
  onCrop,
  width = 1500,
}: CoverCropperProps) => {
  const [image, setImage] = useState<Blob | string | null>(defaultImage);
  const [mode, setMode] = useState<Mode>("loading");
  const [problem, setProblem] = useState<Problem>(null);
  const [picks, setPicks] = useState(0);
  const [saving, setSaving] = useState(false);
  const actions = useRef<CropperApi>(null);
  const before = useRef<CropValue | null>(null);
  const [saved, setSaved] = useState<Saved>({
    image: defaultImage,
    value: null,
  });
  const picked = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const editing = mode === "edit";

  const refocus = (): void => {
    requestAnimationFrame(() => {
      root.current?.querySelector<HTMLElement>("[data-primary]")?.focus();
    });
  };

  const show = (next: Mode): void => {
    setMode(next);
    refocus();
  };

  const restore = (): void => {
    picked.current = false;
    setMode("loading");
    setImage(saved.image);
    setPicks((count) => count + 1);
  };

  const edit = (): void => {
    before.current = actions.current?.getValue() ?? null;
    setProblem(null);
    show("edit");
  };

  const cancel = (): void => {
    setProblem(null);

    if (image !== saved.image) {
      restore();
      refocus();

      return;
    }

    if (before.current) {
      actions.current?.setValue(before.current);
    }

    show("view");
  };

  const save = async (): Promise<void> => {
    const cropper = actions.current;

    if (!cropper) {
      return;
    }

    setSaving(true);
    const file = await cropToFile(cropper, {
      maxSize: { height: Math.round(width / aspect), width },
      name: "cover",
      quality: 0.9,
      type: "image/jpeg",
    }).catch(() => null);

    setSaving(false);

    if (file === null) {
      setProblem("save");

      return;
    }

    setSaved({ image, value: cropper.getValue() });
    setProblem(null);
    show("view");
    onCrop?.(file);
  };

  const value = image === saved.image ? saved.value : null;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10",
        className
      )}
      data-slot="cover-cropper"
      ref={root}
      style={{ aspectRatio: aspect }}
    >
      {image === null ? null : (
        <Cropper
          actionsRef={actions}
          aspect={aspect}
          className="absolute inset-0 gap-0 [--zriz-frame:transparent]"
          disabled={!editing}
          key={picks}
          maxZoom={4}
          onError={() => {
            setProblem("open");
            restore();
          }}
          onLoad={() => {
            setMode(picked.current ? "edit" : "view");
            picked.current = false;
          }}
          src={image}
          svg={false}
          {...(value === null ? null : { defaultValue: value })}
        >
          <CropperViewport
            className="aspect-auto size-full rounded-none p-0"
            grid={false}
            handles={false}
            label="Cover position"
            wheel="zoom"
          />
          {editing ? (
            <div className="absolute bottom-3 left-3 flex h-8 w-36 items-center rounded-lg bg-background px-2 shadow-sm">
              <CropperZoom />
            </div>
          ) : null}
        </Cropper>
      )}
      {editing ? null : <div className="absolute inset-0" />}
      {image === null && problem === null ? (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
          No cover yet
        </p>
      ) : null}
      {problem === null ? null : (
        <p
          className="absolute top-3 left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-md bg-background px-2 py-1 text-xs font-medium text-destructive shadow-sm"
          role="alert"
        >
          {PROBLEMS[problem]}
        </p>
      )}
      {editing && problem === null ? (
        <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-background px-2 py-1 text-xs font-medium whitespace-nowrap shadow-sm">
          Drag to reposition
        </p>
      ) : null}
      <div className="absolute right-3 bottom-3 flex gap-2">
        {editing ? (
          <>
            <Button
              className="shadow-sm"
              disabled={saving}
              key="cancel"
              onClick={cancel}
              size="sm"
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="shadow-sm"
              data-primary=""
              disabled={saving}
              key="save"
              onClick={() => {
                void save();
              }}
              size="sm"
              type="button"
            >
              Save
            </Button>
          </>
        ) : (
          <>
            <Button
              className="shadow-sm"
              key="change"
              onClick={() => {
                input.current?.click();
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {image === null ? "Add cover" : "Change"}
            </Button>
            {mode === "view" && image !== null ? (
              <Button
                className="shadow-sm"
                data-primary=""
                key="reposition"
                onClick={edit}
                size="sm"
                type="button"
                variant="secondary"
              >
                Reposition
              </Button>
            ) : null}
          </>
        )}
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a cover"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          event.currentTarget.value = "";

          if (file) {
            before.current = null;
            picked.current = true;
            setProblem(null);
            setMode("loading");
            setImage(file);
            setPicks((count) => count + 1);
          }
        }}
        ref={input}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
};

export type { CoverCropperProps };
export { CoverCropper };
