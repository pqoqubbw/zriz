const NAV_GROUPS = [
  {
    items: [
      { slug: "introduction", title: "Introduction" },
      { slug: "quick-start", title: "Quick start" },
      { slug: "playground", title: "Playground" },
      { slug: "shadcn", title: "shadcn" },
    ],
    title: "",
  },
  {
    items: [
      { slug: "root", title: "Root" },
      { slug: "viewport", title: "Viewport" },
      { slug: "crop-area", title: "Crop area" },
      { slug: "dial", title: "Dial" },
      { slug: "zoom", title: "Zoom" },
      { slug: "aspect-ratio", title: "Aspect ratio" },
      { slug: "buttons", title: "Buttons" },
    ],
    title: "Components",
  },
  {
    items: [
      { slug: "value", title: "Value" },
      { slug: "events", title: "Events" },
      { slug: "hooks", title: "Hooks" },
      { slug: "cropper", title: "Cropper" },
    ],
    title: "API",
  },
  {
    items: [
      { slug: "loading-images", title: "Loading images" },
      { slug: "styling", title: "Styling" },
      { slug: "composition", title: "Composition" },
      { slug: "exporting", title: "Exporting" },
      { slug: "accessibility", title: "Accessibility" },
      { slug: "security", title: "Security" },
      { slug: "vanilla-js", title: "Vanilla JS" },
    ],
    title: "Guides",
  },
  {
    items: [
      { slug: "avatar", title: "Avatar" },
      { slug: "full-editor", title: "Full editor" },
      { slug: "server-crop", title: "Server crop" },
      { slug: "saving-state", title: "Saving state" },
      { slug: "undo", title: "Undo" },
    ],
    title: "Examples",
  },
  {
    items: [
      { slug: "faq", title: "FAQ" },
      { slug: "errors", title: "Errors" },
      { slug: "bundle-size", title: "Bundle size" },
      { slug: "changelog", title: "Changelog" },
    ],
    title: "Help",
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
