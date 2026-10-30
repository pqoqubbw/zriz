"use client";

import type { CommitDetails, CropValue } from "@zriz/core";
import { use, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useCropperContext } from "../context";
import { mergeProps } from "../merge-props";
import { RootContextValue, useLatest } from "../part";
import type { PartProps } from "../part";
import { useRender } from "../use-render";

export type InstructionsProps = PartProps<"div", object>;

export const Instructions = ({
  render,
  className,
  ref,
  ...props
}: InstructionsProps): ReactElement => {
  const { instructions } = use(RootContextValue);
  return useRender({
    className,
    props: mergeProps(
      { "data-zriz-item": "instructions", hidden: true, id: instructions },
      props
    ),
    ref,
    render,
    state: {},
    tag: "div",
  });
};

export interface AnnouncerProps extends Omit<
  PartProps<"div", object>,
  "children"
> {
  /** What to say after each commit. Return null to stay quiet. */
  announce: (value: CropValue, details: CommitDetails) => string | null;
}

export const Announcer = ({
  announce,
  render,
  className,
  ref,
  ...props
}: AnnouncerProps): ReactElement => {
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
};
