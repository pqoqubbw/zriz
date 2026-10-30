export const pages = [
  {
    description:
      "The smallest zoom that keeps a straightened photo free of empty corners.",
    slug: "use-cover-scale",
    title: "useCoverScale",
  },
] as const;

export type Page = (typeof pages)[number];
