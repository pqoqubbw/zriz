"use client";

import { CopyAction } from "@/components/doc/copy-button";
import { playground } from "@/demos/playground/store";

type PlaygroundCopyProps = {
  label: string;
};

const PlaygroundCopy = ({ label }: PlaygroundCopyProps) => (
  <CopyAction label={label} read={playground.copyText} />
);

export { PlaygroundCopy };
