"use client";

import { viewOf } from "@zriz/core/dom";
import type { Grid as GridMode } from "@zriz/core/dom";
import { useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import type { PartProps } from "../part";
import { useRender } from "../use-render";

export interface GridState {
  grid: GridMode;
}

export type GridProps = PartProps<"div", GridState>;

const LINES = [1, 2, 3, 4, 5, 6, 7, 8];

const lines = LINES.flatMap((k) =>
  (["x", "y"] as const).map((axis) => (
    <span
      data-axis={axis}
      data-coarse={k % 3 === 0 ? "" : undefined}
      key={`${axis}${k}`}
      style={
        axis === "x"
          ? { left: `${(k / 9) * 100}%`, position: "absolute" }
          : { position: "absolute", top: `${(k / 9) * 100}%` }
      }
    />
  ))
);

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
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-hidden": true,
        children: lines,
        "data-grid": grid,
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
