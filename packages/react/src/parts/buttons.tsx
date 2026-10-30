"use client";

import type { Aspect } from "@zriz/core";
import { createContext, use, useCallback } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { useRender } from "../use-render";

export interface RotateProps extends PartProps<"button", object> {
  /** Turn direction. @default "ccw" like Photos */
  direction?: "ccw" | "cw";
}

export const Rotate = ({
  direction = "ccw",
  render,
  className,
  ref,
  ...props
}: RotateProps): ReactElement => {
  const cropper = useCropperContext();
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.rotate90(direction, { event: event.nativeEvent });
    },
    [cropper, direction]
  );
  return useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "rotate", onClick, type: "button" },
      props
    ),
    ref,
    render,
    state: {},
    tag: "button",
  });
};

export interface FlipState {
  mirrored: boolean;
}

export interface FlipProps extends PartProps<"button", FlipState> {
  /** Mirror axis. @default "x" */
  axis?: "x" | "y";
}

export const Flip = ({
  axis = "x",
  render,
  className,
  ref,
  ...props
}: FlipProps): ReactElement => {
  const cropper = useCropperContext();
  const mirrored = useCropperState((s) => s.mirrored);
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.flip(axis, { event: event.nativeEvent });
    },
    [cropper, axis]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-pressed": mirrored,
        "data-mirrored": mirrored ? "" : undefined,
        "data-zriz-item": "flip",
        onClick,
        type: "button",
      },
      props
    ),
    ref,
    render,
    state: { mirrored },
    tag: "button",
  });
};

export interface ResetState {
  pristine: boolean;
}

export type ResetProps = PartProps<"button", ResetState>;

export const Reset = ({
  render,
  className,
  ref,
  ...props
}: ResetProps): ReactElement => {
  const cropper = useCropperContext();
  const pristine = useCropperState((s) => s.pristine);
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.reset({ event: event.nativeEvent });
    },
    [cropper]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "data-pristine": pristine ? "" : undefined,
        "data-zriz-item": "reset",
        hidden: pristine,
        onClick,
        type: "button",
      },
      props
    ),
    ref,
    render,
    state: { pristine },
    tag: "button",
  });
};

const AspectGroupContext = createContext(false);

export interface AspectGroupState {
  aspect: Aspect;
}

export type AspectGroupProps = PartProps<"div", AspectGroupState>;

export const AspectGroup = ({
  render,
  className,
  ref,
  ...props
}: AspectGroupProps): ReactElement => {
  const aspect = useCropperState((s) => s.aspect);
  const element = useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "aspect-group", role: "radiogroup" },
      props
    ),
    ref,
    render,
    state: { aspect },
    tag: "div",
  });
  return <AspectGroupContext value>{element}</AspectGroupContext>;
};

export interface AspectItemState {
  checked: boolean;
}

export interface AspectItemProps extends PartProps<"button", AspectItemState> {
  /** The aspect this item selects: a ratio, "free" or "original". */
  value: Aspect;
}

export const AspectItem = ({
  value,
  render,
  className,
  ref,
  ...props
}: AspectItemProps): ReactElement => {
  const cropper = useCropperContext();
  const inGroup = use(AspectGroupContext);
  const checked = useCropperState((s) => s.aspect === value);
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      cropper.setAspect(value, { event: event.nativeEvent });
    },
    [cropper, value]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-checked": inGroup ? checked : undefined,
        "aria-pressed": inGroup ? undefined : checked,
        "data-checked": checked ? "" : undefined,
        "data-zriz-item": "aspect-item",
        onClick,
        role: inGroup ? "radio" : undefined,
        type: "button",
      },
      props
    ),
    ref,
    render,
    state: { checked },
    tag: "button",
  });
};

export interface OrientationState {
  orientation: "portrait" | "landscape" | "square";
}

export type OrientationProps = PartProps<"button", OrientationState>;

export const Orientation = ({
  render,
  className,
  ref,
  ...props
}: OrientationProps): ReactElement => {
  const cropper = useCropperContext();
  const aspect = useCropperState((s) => s.aspect);
  let orientation: OrientationState["orientation"] = "square";
  if (typeof aspect === "number" && aspect !== 1) {
    orientation = aspect > 1 ? "landscape" : "portrait";
  }
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const current = cropper.getValue().aspect;
      if (typeof current === "number") {
        cropper.setAspect(1 / current, {
          event: event.nativeEvent,
          reason: "aspect",
        });
      }
    },
    [cropper]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "data-orientation": orientation,
        "data-zriz-item": "orientation",
        disabled: typeof aspect !== "number" || aspect === 1,
        onClick,
        type: "button",
      },
      props
    ),
    ref,
    render,
    state: { orientation },
    tag: "button",
  });
};
