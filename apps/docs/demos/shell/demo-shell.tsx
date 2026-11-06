"use client";

import "@zriz/react/styles.css";
import type { ExportOptions } from "@zriz/core/dom";
import type {
  CommitDetails,
  Cropper as CropperApi,
  CropValue,
  HandleProps,
  RootProps,
  ViewportProps,
} from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { DEMO_SPECS } from "@/demos/registry";
import type { DemoName } from "@/demos/registry";
import { DemoContext } from "@/demos/shell/context";
import type { DemoPhoto } from "@/demos/shell/context";
import { FileChips } from "@/demos/shell/file-chips";
import {
  DropVeil,
  Spinner,
  Stage,
  StageContent,
  StageEdge,
} from "@/demos/shell/layout";
import { photoUrl } from "@/demos/shell/photo";
import { Still, useStill } from "@/demos/shell/still";
import { exportRun, useDownload } from "@/demos/shell/use-download";
import type { DemoRun } from "@/demos/shell/use-download";
import { usePhoto } from "@/demos/shell/use-photo";
import { cn } from "@/lib/cn";

type HandlePosition = HandleProps["position"];

type PhotoProps = Pick<RootProps, "defaultValue" | "onValueCommit">;

type DemoShellProps = Omit<
  RootProps,
  | "actionsRef"
  | "children"
  | "className"
  | "onError"
  | "onLoad"
  | "shape"
  | "src"
> & {
  /** The controls under the stage. */
  children?: ReactNode;
  /** Classes for Root, such as colour variables. */
  className?: string;
  /** Export options for the download chip. */
  exportOptions?: ExportOptions;
  /** Draw the crop grid. */
  grid?: boolean;
  /** The crop handles to render. */
  handles?: readonly HandlePosition[];
  /** Sets disabled on Root while the download runs. */
  lock?: boolean;
  /** Which demo this is, for its photo, shape and corner action. */
  name: DemoName;
  /** Replaces the download with another action, such as send. */
  onAction?: DemoRun;
  /** Remounts Root for each photo, with the props it returns. */
  photoProps?: (photo: DemoPhoto) => PhotoProps;
  /** Overrides the crop shape from the demo spec. */
  shape?: RootProps["shape"];
  /** Props for the viewport, such as wheel. */
  viewport?: Pick<ViewportProps, "rotateGesture" | "wheel">;
};

const HANDLES: readonly HandlePosition[] = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
];

const INSTRUCTIONS = [
  "Drag the photo to move it.",
  "Arrows move the crop. Alt and arrows resize it.",
  "Plus and minus zoom, and 0 resets.",
].join(" ");

const SPOKEN: Partial<Record<CommitDetails["reason"], string>> = {
  flip: "Flipped",
  orientation: "Orientation swapped",
  reset: "Crop reset",
  "rotate-90": "Turned 90 degrees",
};

const announce = (_: CropValue, details: CommitDetails): string | null =>
  SPOKEN[details.reason] ?? null;

const photoIdOf = (src: Blob | string, initial: string): string => {
  if (typeof src === "string") {
    return initial;
  }

  return src instanceof File
    ? `${src.name}:${src.size}:${src.lastModified}`
    : `${src.type}:${src.size}`;
};

const DemoShell = ({
  children,
  className,
  exportOptions,
  grid = true,
  handles = HANDLES,
  lock = false,
  name,
  onAction,
  photoProps,
  shape,
  viewport,
  ...root
}: DemoShellProps) => {
  const spec = DEMO_SPECS[name];
  const actions = useRef<CropperApi>(null);
  const download = useDownload(actions, onAction ?? exportRun(exportOptions));
  const content = useRef<HTMLDivElement>(null);
  const still = useStill(photoProps !== undefined, content);
  const photo = usePhoto(photoUrl(spec.photo), () => {
    download.abort();
    still.keep();
  });
  const { dropping, pick, src } = photo;
  const locked = lock && download.busy;
  const busy = photo.loading || dropping;
  const id = photoIdOf(src, spec.photo);
  const state = useMemo(
    () => ({ dim: busy, photo: { id, key: `${id}:${pick}` } }),
    [busy, id, pick]
  );

  return (
    <DemoContext.Provider value={state}>
      <Cropper.Root
        key={photoProps ? state.photo.key : undefined}
        {...root}
        {...photoProps?.(state.photo)}
        {...(lock ? { disabled: locked } : null)}
        actionsRef={actions}
        className={cn("flex w-full flex-col items-center", className)}
        onError={(error) => {
          still.clear();
          photo.handleError(error);
        }}
        onLoad={() => {
          if (!photoProps && photo.replacing) {
            actions.current?.reset({ emit: false });
          }

          still.clear();
          photo.handleLoad();
        }}
        shape={shape ?? spec.shape}
        src={photo.src}
      >
        <Stage
          {...photo.drop}
          onDragEnter={(event) => {
            if (!photo.dropping) {
              still.keepPhoto();
            }

            photo.drop.onDragEnter(event);
          }}
        >
          {photo.dropping ? null : (
            <FileChips
              action={spec.action}
              dim={busy || locked}
              download={download}
              photo={photo}
            />
          )}
          <StageContent
            data-dropping={dropping ? "" : undefined}
            data-loading={photo.replacing ? "" : undefined}
            ref={content}
          >
            <Cropper.Viewport
              {...viewport}
              className="absolute inset-0 px-6 py-15 @max-demo-narrow:px-5"
            >
              <Cropper.Image />
              <Cropper.Mask />
              <Cropper.Area
                aria-label="Crop area"
                className="focus-visible:corners-none"
              >
                {grid ? <Cropper.Grid /> : null}
                {handles.map((position) => (
                  <Cropper.Handle key={position} position={position} />
                ))}
              </Cropper.Area>
            </Cropper.Viewport>
          </StageContent>
          <Still node={photo.loading ? still.node : null} />
          {photo.loading ? <Spinner /> : null}
          {photo.dropping ? <Still node={still.cover} tone="cover" /> : null}
          {photo.dropping ? <DropVeil /> : null}
          <StageEdge />
        </Stage>
        {children}
        <Cropper.Instructions>{INSTRUCTIONS}</Cropper.Instructions>
        <Cropper.Announcer announce={announce} />
      </Cropper.Root>
    </DemoContext.Provider>
  );
};

export type { DemoShellProps, HandlePosition, PhotoProps };
export { DemoShell };
