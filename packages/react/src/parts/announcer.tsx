"use client";

import type { CommitDetails, CropValue } from "@zriz/core";
import { forwardRef, useEffect, useState } from "react";

import { useCropperContext } from "../context";
import { useLatest } from "../part";
import type { Part, PartProps } from "../part";
import { usePart } from "../use-render";

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
>(function Announcer({ announce, ...props }, ref) {
  const cropper = useCropperContext();
  const latest = useLatest(announce);
  const [message, setMessage] = useState("");
  useEffect(
    () =>
      cropper.on("commit", (value, details) => {
        const next = latest.current(value, details) ?? "";
        setMessage((last) =>
          next !== "" && last.trimEnd() === next
            ? `${next}${last.endsWith("\u00A0") ? "" : "\u00A0"}`
            : next
        );
      }),
    [cropper, latest]
  );
  return usePart(
    "div",
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
    props,
    ref,
    {}
  );
});
