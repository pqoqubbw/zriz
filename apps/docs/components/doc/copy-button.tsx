"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type CopiedStatusProps = {
  copied: boolean;
};

type CopyProps = {
  label: string;
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

export type { CopiedStatusProps, CopyProps };
export { CopiedStatus, CopyButton, useCopy };
