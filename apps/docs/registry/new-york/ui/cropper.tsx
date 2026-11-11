"use client";

import "@zriz/react/styles.css";
import { exportCrop } from "@zriz/core/dom";
import type { ExportOptions } from "@zriz/core/dom";
import type {
  AspectGroupProps,
  AspectItemProps,
  CommitDetails,
  CropValue,
  Cropper as CropperApi,
  DialProps,
  FlipProps,
  ResetProps,
  RootProps,
  RotateProps,
  ViewportProps,
  ZoomProps,
  ZoomStepProps,
} from "@zriz/react";
import * as CropperPrimitive from "@zriz/react/cropper";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/registry/new-york/ui/button";

type Styled<P> = Omit<P, "className"> & { className?: string };

type CropperProps = Styled<RootProps>;

type CropperViewportProps = Styled<Omit<ViewportProps, "children">> & {
  grid?: boolean;
  handles?: boolean;
  label?: string;
};

type CropperZoomProps = Styled<Omit<ZoomProps, "children">>;

type CropperDialProps = Styled<Omit<DialProps, "children">>;

type CropperAspectItemProps = Styled<AspectItemProps>;

type CropFileOptions = ExportOptions & { name?: string };

type IconProps = { children: ReactNode };

const HANDLES = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
] as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ZOOM_STEP = 1.25;

const INSTRUCTIONS =
  "Drag the photo to move it. Arrows move the crop. Alt and arrows resize it. Plus and minus zoom, and 0 resets.";

const SPOKEN: Partial<Record<CommitDetails["reason"], string>> = {
  flip: "Flipped",
  orientation: "Orientation swapped",
  reset: "Crop reset",
  "rotate-90": "Turned 90 degrees",
};

const announce = (_: CropValue, details: CommitDetails): string | null =>
  SPOKEN[details.reason] ?? null;

const MINUS = "−";

const formatAngle = (degrees: number): string => {
  const rounded = Math.round(degrees);

  return `${rounded < 0 ? MINUS : ""}${Math.abs(rounded)}°`;
};

const cropToFile = async (
  cropper: CropperApi,
  { name = "crop", ...options }: CropFileOptions = {}
): Promise<File> => {
  const { blob, type } = await exportCrop(cropper, options);

  return new File([blob], `${name}.${EXTENSIONS[type] ?? "png"}`, { type });
};

const Icon = ({ children }: IconProps) => (
  <svg
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 20 20"
  >
    {children}
  </svg>
);

const Cropper = ({ children, className, ...props }: CropperProps) => (
  <CropperPrimitive.Root
    className={cn(
      "flex w-full min-w-0 flex-col gap-3 [--zriz-accent:var(--primary)] [--zriz-line:var(--foreground)] [--zriz-tick:var(--muted-foreground)]",
      className
    )}
    data-slot="cropper"
    {...props}
  >
    {children}
    <CropperPrimitive.Instructions>
      {INSTRUCTIONS}
    </CropperPrimitive.Instructions>
    <CropperPrimitive.Announcer announce={announce} />
  </CropperPrimitive.Root>
);

const CropperViewport = ({
  className,
  grid = true,
  handles = true,
  label = "Crop area",
  ...props
}: CropperViewportProps) => (
  <CropperPrimitive.Viewport
    className={cn(
      "relative aspect-square w-full rounded-lg bg-background p-5",
      className
    )}
    data-slot="cropper-viewport"
    {...props}
  >
    <CropperPrimitive.Image />
    <CropperPrimitive.Mask />
    <CropperPrimitive.Area aria-label={label}>
      {grid ? <CropperPrimitive.Grid /> : null}
      {handles
        ? HANDLES.map((position) => (
            <CropperPrimitive.Handle key={position} position={position} />
          ))
        : null}
    </CropperPrimitive.Area>
  </CropperPrimitive.Viewport>
);

const CropperZoom = ({ className, ...props }: CropperZoomProps) => (
  <CropperPrimitive.Zoom
    aria-label="Zoom"
    className={cn(
      "group/zoom relative mx-1.5 h-5 min-w-0 flex-1 outline-none",
      className
    )}
    data-slot="cropper-zoom"
    {...props}
  >
    <span className="absolute -inset-x-1.5 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/15">
      <span className="absolute inset-x-1.5 inset-y-0">
        <CropperPrimitive.ZoomThumb className="inset-y-0 w-0 before:absolute before:inset-y-0 before:end-0 before:w-[100vw] before:bg-primary" />
      </span>
    </span>
    <CropperPrimitive.ZoomThumb className="top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ring bg-white ring-ring/50 group-hover/zoom:ring-3 group-focus-visible/zoom:ring-3 rtl:translate-x-1/2" />
  </CropperPrimitive.Zoom>
);

const CropperZoomOut = ({ children, ...props }: Partial<ZoomStepProps>) => (
  <CropperPrimitive.ZoomStep
    aria-label="Zoom out"
    factor={1 / ZOOM_STEP}
    render={
      <Button
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        type="button"
        size="icon"
        variant="ghost"
      />
    }
    {...props}
  >
    {children ?? (
      <Icon>
        <path d="M5 10H15" />
      </Icon>
    )}
  </CropperPrimitive.ZoomStep>
);

const CropperZoomIn = ({ children, ...props }: Partial<ZoomStepProps>) => (
  <CropperPrimitive.ZoomStep
    aria-label="Zoom in"
    factor={ZOOM_STEP}
    render={
      <Button
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        type="button"
        size="icon"
        variant="ghost"
      />
    }
    {...props}
  >
    {children ?? (
      <Icon>
        <path d="M5 10H15M10 5V15" />
      </Icon>
    )}
  </CropperPrimitive.ZoomStep>
);

const CropperDial = ({ className, ...props }: CropperDialProps) => (
  <div
    className={cn(
      "relative h-10 min-w-0 flex-1 rounded-md ring-ring/50 has-focus-visible:ring-3",
      className
    )}
    data-slot="cropper-dial"
  >
    <div className="absolute inset-x-0 top-[11px]">
      <CropperPrimitive.Dial
        aria-label="Straighten"
        className="w-full outline-none"
        {...props}
      >
        <CropperPrimitive.DialTicks />
      </CropperPrimitive.Dial>
    </div>
  </div>
);

const CropperAngle = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    className={cn(
      "w-9 text-center text-xs text-muted-foreground tabular-nums",
      className
    )}
    data-slot="cropper-angle"
    {...props}
  >
    <CropperPrimitive.DialValue format={formatAngle} />
  </span>
);

const CropperRotate = ({ children, ...props }: RotateProps) => (
  <CropperPrimitive.Rotate
    aria-label="Rotate left"
    render={
      <Button
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        type="button"
        size="icon"
        variant="ghost"
      />
    }
    {...props}
  >
    {children ?? (
      <Icon>
        <path d="M5.5 9.5H10.5A1.5 1.5 0 0 1 12 11V15A1.5 1.5 0 0 1 10.5 16.5H5.5A1.5 1.5 0 0 1 4 15V11A1.5 1.5 0 0 1 5.5 9.5Z" />
        <path d="M16 12.5V9.5A4 4 0 0 0 12 5.5H9" />
        <path d="M11 3.5L9 5.5L11 7.5" />
      </Icon>
    )}
  </CropperPrimitive.Rotate>
);

const CropperFlip = ({ children, ...props }: FlipProps) => (
  <CropperPrimitive.Flip
    aria-label="Flip"
    render={
      <Button
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        type="button"
        size="icon"
        variant="ghost"
      />
    }
    {...props}
  >
    {children ?? (
      <Icon>
        <path d="M8.5 4.5V15.5H3.5Z" />
        <path d="M11.5 4.5V15.5H16.5Z" />
      </Icon>
    )}
  </CropperPrimitive.Flip>
);

const CropperReset = ({ children, ...props }: ResetProps) => (
  <CropperPrimitive.Reset
    render={
      <Button
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        type="button"
        size="sm"
        variant="ghost"
      />
    }
    {...props}
  >
    {children ?? "Reset"}
  </CropperPrimitive.Reset>
);

const CropperAspect = ({ className, ...props }: Styled<AspectGroupProps>) => (
  <CropperPrimitive.AspectGroup
    aria-label="Aspect ratio"
    className={cn(
      "inline-flex h-8 w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground",
      className
    )}
    data-slot="cropper-aspect"
    {...props}
  />
);

const CropperAspectItem = ({ className, ...props }: CropperAspectItemProps) => (
  <CropperPrimitive.AspectItem
    className={cn(
      "inline-flex h-full items-center justify-center rounded-md border border-transparent px-2 text-sm font-medium whitespace-nowrap tabular-nums outline-none select-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm",
      className
    )}
    data-slot="cropper-aspect-item"
    {...props}
  />
);

export type { CropFileOptions, CropperProps, CropperViewportProps };
export {
  Cropper,
  CropperAngle,
  CropperAspect,
  CropperAspectItem,
  CropperDial,
  CropperFlip,
  CropperReset,
  CropperRotate,
  CropperViewport,
  CropperZoom,
  CropperZoomIn,
  CropperZoomOut,
  cropToFile,
};
