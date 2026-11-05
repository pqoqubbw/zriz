"use client";

import type { ComponentType } from "react";

import type { DemoName } from "@/demos/registry";

type DemoModule = {
  default: ComponentType;
};

type DemoLoader = () => Promise<DemoModule>;

const DEMO_LOADERS = {
  "aspect-ratio": async () => await import("./aspect-ratio/demo"),
  avatar: async () => await import("./avatar/demo"),
  buttons: async () => await import("./buttons/demo"),
  "crop-area": async () => await import("./crop-area/demo"),
  dial: async () => await import("./dial/demo"),
  exporting: async () => await import("./exporting/demo"),
  "full-editor": async () => await import("./full-editor/demo"),
  introduction: async () => await import("./introduction/demo"),
  playground: async () => await import("./playground/demo"),
  "quick-start": async () => await import("./quick-start/demo"),
  root: async () => await import("./root/demo"),
  "saving-state": async () => await import("./saving-state/demo"),
  "server-crop": async () => await import("./server-crop/demo"),
  styling: async () => await import("./styling/demo"),
  undo: async () => await import("./undo/demo"),
  viewport: async () => await import("./viewport/demo"),
  zoom: async () => await import("./zoom/demo"),
} satisfies Record<DemoName, DemoLoader>;

export type { DemoLoader, DemoModule };
export { DEMO_LOADERS };
