const NAV_GROUPS = [
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

type Slug = (typeof NAV_GROUPS)[number]["items"][number]["slug"];

type Entry = {
  slug: Slug;
  title: string;
};

const NAV_ENTRIES: readonly Entry[] = NAV_GROUPS.flatMap(
  (group): readonly Entry[] => group.items
);

const PAGE_ORDER: readonly Slug[] = NAV_ENTRIES.map((entry) => entry.slug);

const isSlug = (candidate: string): candidate is Slug =>
  PAGE_ORDER.some((slug) => slug === candidate);

const titleOf = (slug: Slug): string =>
  NAV_ENTRIES.find((entry) => entry.slug === slug)?.title ?? slug;

const withAnchor = (path: string, anchor: string): string =>
  anchor === "" ? path : `${path}#${anchor}`;

const pagePath = (slug: Slug, anchor = ""): string =>
  withAnchor(`/docs/${slug}`, anchor);

const markdownPath = (slug: Slug, anchor = ""): string =>
  withAnchor(`/docs/${slug}.md`, anchor);

const slugParams = (): { slug: Slug }[] => PAGE_ORDER.map((slug) => ({ slug }));

export type { Slug };
export {
  isSlug,
  markdownPath,
  NAV_ENTRIES,
  NAV_GROUPS,
  PAGE_ORDER,
  pagePath,
  slugParams,
  titleOf,
};
