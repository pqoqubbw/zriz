export const demos = {
  "aspect-ratio": { height: 320 },
  avatar: { height: 320 },
  buttons: { height: 320 },
  "crop-area": { height: 320 },
  dial: { height: 320 },
  exporting: { height: 320 },
  "full-editor": { height: 320 },
  introduction: { height: 320 },
  playground: { height: 454 },
  "quick-start": { height: 320 },
  root: { height: 320 },
  "saving-state": { height: 320 },
  "server-crop": { height: 320 },
  styling: { height: 320 },
  undo: { height: 320 },
  viewport: { height: 320 },
  zoom: { height: 320 },
} as const satisfies Record<string, { height: 320 | 454 }>;

export type DemoName = keyof typeof demos;
