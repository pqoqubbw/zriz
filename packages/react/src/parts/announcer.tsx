"use client";

import type { CommitDetails, CropValue } from "@zriz/core";
import { forwardRef, useEffect, useState } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { useLatest } from "../part";
import type { Part, PartProps } from "../part";
import { useRender } from "../use-render";

export interface AnnouncerProps extends Omit<
  PartProps<"div", object>,
  "children"
> {
  /** What to say after each commit. Return null to stay quiet. */
  announce: (value: CropValue, details: CommitDetails) => string | null;
}

export const Announcer: Part<AnnouncerProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  AnnouncerProps
>(function Announcer({ announce, render, className, ...props }, ref) {
  const cropper = useCropperContext();
  const latest = useLatest(announce);
  const [message, setMessage] = useState("");
  useEffect(
    () =>
      cropper.on("commit", (value, details) => {
        setMessage(latest.current(value, details) ?? "");
      }),
    [cropper, latest]
  );
  return useRender({
    className,
    props: mergeProps(
      {
        "aria-live": "polite",
        children: message,
        "data-zriz-item": "announcer",
        role: "status",
        style: {
          clipPath: "inset(50%)",
          height: 1,
          overflow: "hidden",
          position: "absolute",
          whiteSpace: "nowrap",
          width: 1,
        },
      },
      props
    ),
    ref,
    render,
    state: {},
    tag: "div",
  });
});
