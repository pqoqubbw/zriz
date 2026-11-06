"use client";

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { useState } from "react";
import type { RefObject } from "react";

type StillProps = VariantProps<typeof stillVariants> & {
  node: HTMLElement | null;
};

type StillState = {
  clear: () => void;
  cover: HTMLElement | null;
  keep: () => void;
  keepPhoto: () => void;
  node: HTMLElement | null;
};

const DROPPED = ["data-ready", "id", "tabindex"] as const;

const MASK = '[data-zriz-item="mask"]';

const AREA = '[data-zriz-item="area"]';

const stillVariants = cva("pointer-events-none absolute inset-0", {
  defaultVariants: { tone: "dim" },
  variants: { tone: { cover: "bg-page", dim: "opacity-40" } },
});

const snapshot = (
  from: HTMLElement,
  photoOnly: boolean
): HTMLElement | null => {
  if (!from.querySelector('[data-zriz-item="image"][data-ready]')) {
    return null;
  }

  const copy = from.cloneNode(true);

  if (!(copy instanceof HTMLElement)) {
    return null;
  }

  const sources = from.querySelectorAll("canvas");

  for (const [index, canvas] of copy.querySelectorAll("canvas").entries()) {
    const source = sources.item(index);

    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
  }

  if (photoOnly) {
    copy.querySelector(AREA)?.remove();

    const mask = copy.querySelector(MASK);

    if (mask instanceof HTMLElement) {
      delete mask.dataset.interacting;
      mask.style.removeProperty("clip-path");
      mask.style.removeProperty("mask-image");
      mask.style.removeProperty("-webkit-mask-image");
    }
  }

  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of DROPPED) {
      element.removeAttribute(name);
    }
  }

  return copy;
};

const useStill = (
  enabled: boolean,
  content: RefObject<HTMLDivElement | null>
): StillState => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [cover, setCover] = useState<HTMLElement | null>(null);

  return {
    clear: () => {
      setNode(null);
    },
    cover,
    keep: () => {
      if (enabled && content.current) {
        setNode(snapshot(content.current, false));
      }
    },
    keepPhoto: () => {
      setCover(
        (content.current && snapshot(content.current, true)) ??
          document.createElement("div")
      );
    },
    node,
  };
};

const Still = ({ node, tone }: StillProps) =>
  node ? (
    <div
      aria-hidden="true"
      className={stillVariants({ tone })}
      data-slot="still"
      inert
      ref={(element) => {
        element?.replaceChildren(node);
      }}
    />
  ) : null;

export type { StillState };
export { Still, useStill };
