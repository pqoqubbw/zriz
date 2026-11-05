"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { playground } from "@/demos/playground/store";
import { cn } from "@/lib/cn";

type CopiedStatusProps = {
  copied: boolean;
};

type CopyProps = {
  label: string;
};

type CopyActionProps = CopyProps & {
  read?: () => string | null;
};

const useCopy = (read?: () => string | null) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    []
  );

  const copy = async (button: HTMLButtonElement) => {
    const source = button
      .closest("[data-copy]")
      ?.querySelector("[data-copy-text]");

    await navigator.clipboard.writeText(read?.() ?? source?.textContent ?? "");
    setCopied(true);
    clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    void copy(event.currentTarget);
  };

  return { copied, onClick };
};

const CopiedStatus = ({ copied }: CopiedStatusProps) => (
  <span aria-live="polite" className="sr-only">
    {copied ? "Copied" : ""}
  </span>
);

const CopyButton = ({ label }: CopyProps) => {
  const { copied, onClick } = useCopy();

  return (
    <>
      <Button aria-label={label} onClick={onClick} size="icon" variant="ghost">
        <Icon
          className="size-4 opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100"
          name={copied ? "check" : "copy"}
        />
      </Button>
      <CopiedStatus copied={copied} />
    </>
  );
};

const CopyAction = ({ label, read }: CopyActionProps) => {
  const { copied, onClick } = useCopy(read);

  return (
    <>
      <Button onClick={onClick}>
        <span className="grid">
          <span className={cn("[grid-area:1/1]", copied && "invisible")}>
            {label}
          </span>
          <span
            aria-hidden="true"
            className={cn("[grid-area:1/1]", !copied && "invisible")}
          >
            copied
          </span>
        </span>
      </Button>
      <CopiedStatus copied={copied} />
    </>
  );
};

const PlaygroundCopy = ({ label }: CopyProps) => (
  <CopyAction label={label} read={playground.copyText} />
);

export { CopyAction, CopyButton, PlaygroundCopy };
