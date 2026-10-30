"use client";

import { useState } from "react";

export const Copy = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      className="copy"
      onClick={() => {
        void copy();
      }}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
};
