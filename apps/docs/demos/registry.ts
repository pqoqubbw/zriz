const DEMO_NAMES = [
  "aspect-ratio",
  "avatar",
  "buttons",
  "crop-area",
  "dial",
  "exporting",
  "full-editor",
  "introduction",
  "playground",
  "quick-start",
  "root",
  "saving-state",
  "server-crop",
  "styling",
  "undo",
  "viewport",
  "zoom",
] as const;

type DemoName = (typeof DEMO_NAMES)[number];

const TALL_DEMO: DemoName = "playground";

export type { DemoName };
export { TALL_DEMO };
