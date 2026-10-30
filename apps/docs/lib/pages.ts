export const pages = [
  {
    description: "Install zriz and crop an avatar in ten lines.",
    slug: "getting-started",
    title: "Getting started",
  },
  {
    description:
      "Every part: handles, grid, straighten dial, aspects, rotate, flip, reset and export.",
    slug: "editor",
    title: "Editor",
  },
  {
    description:
      "Restyle the parts or bring your own elements: classes, data attributes, variables and render props.",
    slug: "styling",
    title: "Styling",
  },
  {
    description:
      "Formats, EXIF, colour, memory, errors, and cropping the original on a server.",
    slug: "images",
    title: "Images and export",
  },
  {
    description:
      "The same cropper from @zriz/core with one binder per element.",
    slug: "vanilla",
    title: "Without React",
  },
  {
    description: "Keys, labels, announcements and forced colours.",
    slug: "accessibility",
    title: "Accessibility",
  },
  {
    description:
      "The smallest zoom that keeps a straightened photo free of empty corners.",
    slug: "use-cover-scale",
    title: "useCoverScale",
  },
] as const;

export type Page = (typeof pages)[number];
