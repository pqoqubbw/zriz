"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/doc/icon";

const useCopy = () => {
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
    await navigator.clipboard.writeText(source?.textContent ?? "");
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
    }, 1500);
  };
  return { copied, copy };
};

export const CopyButton = ({ label }: { label: string }) => {
  const { copied, copy } = useCopy();
  return (
    <>
      <button
        aria-label={label}
        className="group relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md after:absolute after:-inset-2.5"
        onClick={(event) => {
          void copy(event.currentTarget);
        }}
        type="button"
      >
        <Icon
          className="size-4 opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100"
          name={copied ? "check" : "copy"}
        />
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
};

export const CopyAction = ({ label }: { label: string }) => {
  const { copied, copy } = useCopy();
  return (
    <>
      <button
        className="rounded-control text-control shadow-button hover:bg-hover relative flex h-8 cursor-pointer items-center bg-white px-3.5 font-medium after:absolute after:inset-x-0 after:-inset-y-1.5"
        onClick={(event) => {
          void copy(event.currentTarget);
        }}
        type="button"
      >
        {label}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
};
