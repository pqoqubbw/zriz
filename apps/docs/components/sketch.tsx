"use client";

import { useEffect, useRef } from "react";

interface SketchDemo {
  try: string;
  mount: (root: HTMLElement, options: { reduced: boolean }) => () => void;
}

declare global {
  interface Window {
    DEMOS?: Record<string, SketchDemo | undefined>;
  }
}

export const Sketch = () => {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    let cleanup: (() => void) | undefined;
    const mount = () => {
      const demo = window.DEMOS?.crop;
      if (node !== null && demo !== undefined) {
        cleanup = demo.mount(node, {
          reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
      }
    };
    const registry = window.DEMOS ?? {};
    window.DEMOS = registry;
    if (registry.crop === undefined) {
      const script = document.createElement("script");
      script.src = "/sketch/crop.js";
      script.addEventListener("load", mount);
      document.body.append(script);
    } else {
      mount();
    }
    return () => cleanup?.();
  }, []);
  return <div className="sketch" ref={root} />;
};
