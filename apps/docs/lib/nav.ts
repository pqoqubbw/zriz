export const groups = [
  {
    items: [
      { slug: "introduction", title: "introduction" },
      { slug: "quick-start", title: "quick start" },
      { slug: "playground", title: "playground" },
    ],
    title: "",
  },
  {
    items: [
      { slug: "root", title: "root" },
      { slug: "viewport", title: "viewport" },
      { slug: "crop-area", title: "crop area" },
      { slug: "dial", title: "dial" },
      { slug: "zoom", title: "zoom" },
      { slug: "aspect-ratio", title: "aspect ratio" },
      { slug: "buttons", title: "buttons" },
    ],
    title: "components",
  },
  {
    items: [
      { slug: "value", title: "value" },
      { slug: "events", title: "events" },
      { slug: "hooks", title: "hooks" },
      { slug: "cropper", title: "cropper" },
    ],
    title: "api",
  },
  {
    items: [
      { slug: "loading-images", title: "loading images" },
      { slug: "styling", title: "styling" },
      { slug: "composition", title: "composition" },
      { slug: "exporting", title: "exporting" },
      { slug: "accessibility", title: "accessibility" },
      { slug: "vanilla-js", title: "vanilla js" },
    ],
    title: "guides",
  },
  {
    items: [
      { slug: "avatar", title: "avatar" },
      { slug: "full-editor", title: "full editor" },
      { slug: "server-crop", title: "server crop" },
      { slug: "saving-state", title: "saving state" },
      { slug: "undo", title: "undo" },
    ],
    title: "examples",
  },
  {
    items: [
      { slug: "faq", title: "faq" },
      { slug: "errors", title: "errors" },
      { slug: "bundle-size", title: "bundle size" },
      { slug: "changelog", title: "changelog" },
    ],
    title: "help",
  },
] as const;

export type Slug = (typeof groups)[number]["items"][number]["slug"];

export interface Entry {
  slug: Slug;
  title: string;
}

export const entries: readonly Entry[] = groups.flatMap(
  (group): readonly Entry[] => group.items
);

export const order: readonly Slug[] = entries.map((entry) => entry.slug);

export const isSlug = (candidate: string): candidate is Slug =>
  order.some((slug) => slug === candidate);

export const titleOf = (slug: Slug): string =>
  entries.find((entry) => entry.slug === slug)?.title ?? slug;

export const pathOf = (slug: Slug): string => `/docs/${slug}`;
