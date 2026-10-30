"use client";

import { viewOf } from "@zriz/core/dom";
import type { Grid as GridMode } from "@zriz/core/dom";
import { useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { PartProps } from "../part";
import { useRender } from "../use-render";

export interface GridState {
  grid: GridMode;
}

export type GridProps = PartProps<"div", GridState>;

const line = (axis: "x" | "y", at: number, coarse: boolean): ReactElement => (
  <span
    data-axis={axis}
    data-coarse={coarse ? "" : undefined}
    key={`${axis}${at}`}
    style={
      axis === "x"
        ? { bottom: 0, left: `${at * 100}%`, position: "absolute", top: 0 }
        : { left: 0, position: "absolute", right: 0, top: `${at * 100}%` }
    }
  />
);

const linesFor = (mode: "coarse" | "fine"): ReactElement[] => {
  const count = mode === "fine" ? 9 : 3;
  return Array.from({ length: count - 1 }, (_, i) => i + 1).flatMap((k) => [
    line("x", k / count, mode === "coarse"),
    line("y", k / count, mode === "coarse"),
  ]);
};

const coarseLines = linesFor("coarse");
const fineLines = linesFor("fine");

export const Grid = ({
  render,
  className,
  ref,
  ...props
}: GridProps): ReactElement => {
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
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-hidden": true,
        children: shown === "fine" ? fineLines : coarseLines,
        "data-grid": grid,
        "data-visible": grid === "none" ? undefined : "",
        "data-zriz-item": "grid",
        style: { inset: 0, pointerEvents: "none", position: "absolute" },
      },
      props
    ),
    ref,
    render,
    state: { grid },
    tag: "div",
  });
};
