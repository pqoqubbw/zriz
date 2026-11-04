"use client";

import { viewOf } from "@zriz/core/dom";
import type { Grid as GridMode } from "@zriz/core/dom";
import { forwardRef, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { keepStyle, useKeptStyle } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

export interface GridState {
  grid: GridMode;
}

export type GridProps = PartProps<"div", GridState>;

const STYLE = {
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
} as const;

const keep = keepStyle(STYLE);

const line = (axis: "x" | "y", at: number, coarse: boolean): ReactElement => {
  const style =
    axis === "x"
      ? ({
          bottom: 0,
          left: `${at * 100}%`,
          position: "absolute",
          top: 0,
        } as const)
      : ({
          left: 0,
          position: "absolute",
          right: 0,
          top: `${at * 100}%`,
        } as const);
  return (
    <span
      data-axis={axis}
      data-coarse={coarse ? "" : undefined}
      key={`${axis}${at}`}
      ref={keepStyle(style)}
      style={style}
    />
  );
};

const linesFor = (mode: "coarse" | "fine"): ReactElement[] => {
  const count = mode === "fine" ? 9 : 3;
  return Array.from({ length: count - 1 }, (_, i) => i + 1).flatMap((k) => [
    line("x", k / count, mode === "coarse"),
    line("y", k / count, mode === "coarse"),
  ]);
};

const lines: Partial<Record<"coarse" | "fine", ReactElement[]>> = {};

const linesOf = (mode: "coarse" | "fine"): ReactElement[] =>
  (lines[mode] ??= linesFor(mode));

export const Grid: Part<GridProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  GridProps
>(function Grid(props, ref) {
  const cropper = useCropperContext();
  const view = viewOf(cropper);
  const grid = useSyncExternalStore(
    view.onChrome,
    () => view.chrome().grid,
    () => "none" as const
  );
  const [shown, setShown] = useState<"coarse" | "fine">("coarse");
  if (grid !== "none" && grid !== shown) {
    setShown(grid);
  }
  return usePart(
    "div",
    {
      "aria-hidden": true,
      children: linesOf(shown),
      "data-grid": grid,
      "data-visible": grid === "none" ? undefined : "",
      "data-zriz-item": "grid",
      style: STYLE,
    },
    props,
    useKeptStyle(keep, ref),
    { grid }
  );
});
