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
import { cva } from "class-variance-authority";
import { useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { DEMO_SPECS } from "@/demos/registry";
import type { DemoName } from "@/demos/registry";
import { DemoContext } from "@/demos/shell/context";
import { FileChips } from "@/demos/shell/file-chips";
import {
  DropVeil,
  Spinner,
  Stage,
  StageContent,
  StageEdge,
} from "@/demos/shell/layout";
import { photoUrl } from "@/demos/shell/photo";
import { exportRun, useDownload } from "@/demos/shell/use-download";
import type { DemoRun } from "@/demos/shell/use-download";
import { usePhoto } from "@/demos/shell/use-photo";

type HandlePosition = HandleProps["position"];

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
  /** Overrides the crop shape from the demo spec. */
  shape?: RootProps["shape"];
  /** Props for the viewport, such as wheel. */
  viewport?: Pick<ViewportProps, "rotateGesture" | "wheel">;
};

const coverVariants = cva("", {
  variants: { dropping: { false: "", true: "opacity-0" } },
});

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

const DemoShell = ({
  children,
  exportOptions,
  grid = true,
  handles = HANDLES,
  lock = false,
  name,
  onAction,
  shape,
  viewport,
  ...root
}: DemoShellProps) => {
  const spec = DEMO_SPECS[name];
  const actions = useRef<CropperApi>(null);
  const photo = usePhoto(photoUrl(spec.photo));
  const download = useDownload(actions, onAction ?? exportRun(exportOptions));
  const { dropping } = photo;
  const locked = lock && download.busy;
  const busy = photo.loading || dropping;
  const state = useMemo(() => ({ dim: busy }), [busy]);

  return (
    <DemoContext.Provider value={state}>
      <Cropper.Root
        {...root}
        {...(lock ? { disabled: locked } : null)}
        actionsRef={actions}
        className="flex w-full flex-col items-center"
        onError={photo.handleError}
        onLoad={photo.handleLoad}
        shape={shape ?? spec.shape}
        src={photo.src}
      >
        <Stage {...photo.drop}>
          {photo.dropping ? null : (
            <FileChips
              action={spec.action}
              dim={busy || locked}
              download={download}
              photo={photo}
            />
          )}
          <StageContent data-loading={photo.loading ? "" : undefined}>
            <Cropper.Viewport
              {...viewport}
              className="absolute inset-0 px-6 py-15 @max-demo-narrow:px-5"
            >
              <Cropper.Image />
              <Cropper.Mask className={coverVariants({ dropping })} />
              <Cropper.Area
                aria-label="Crop area"
                className={coverVariants({
                  className: "focus-visible:corners-none",
                  dropping,
                })}
              >
                {grid ? <Cropper.Grid className="grid-hold" /> : null}
                {handles.map((position) => (
                  <Cropper.Handle key={position} position={position} />
                ))}
              </Cropper.Area>
            </Cropper.Viewport>
          </StageContent>
          {photo.loading ? <Spinner /> : null}
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

export type { DemoShellProps, HandlePosition };
export { DemoShell };
