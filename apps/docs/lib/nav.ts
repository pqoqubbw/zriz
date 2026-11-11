const NAV_GROUPS = [
  {
    items: [
      { slug: "introduction", title: "Introduction" },
      { slug: "quick-start", title: "Quick start" },
      { slug: "playground", title: "Playground" },
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
      { slug: "comparison", title: "Comparison" },
      { slug: "changelog", title: "Changelog" },
    ],
    title: "Help",
  },
] as const;

const COMPARISON_PAGES = [
  { slug: "zriz-vs-react-easy-crop", title: "zriz vs react-easy-crop" },
  { slug: "zriz-vs-react-image-crop", title: "zriz vs react-image-crop" },
  { slug: "zriz-vs-cropperjs", title: "zriz vs Cropper.js" },
  { slug: "zriz-vs-ark-ui", title: "zriz vs Ark UI Image Cropper" },
  { slug: "zriz-vs-react-avatar-editor", title: "zriz vs react-avatar-editor" },
  { slug: "zriz-vs-react-cropper", title: "zriz vs react-cropper" },
  { slug: "zriz-vs-uppy-image-editor", title: "zriz vs Uppy Image Editor" },
  {
    slug: "zriz-vs-react-advanced-cropper",
    title: "zriz vs react-advanced-cropper",
  },
  { slug: "zriz-vs-croppie", title: "zriz vs Croppie" },
  { slug: "zriz-vs-antd-img-crop", title: "zriz vs antd-img-crop" },
] as const;

const COMPARISON_HUB = "comparison";

type NavSlug = (typeof NAV_GROUPS)[number]["items"][number]["slug"];

type ComparisonSlug = (typeof COMPARISON_PAGES)[number]["slug"];

type Slug = ComparisonSlug | NavSlug;

type Entry = {
  slug: Slug;
  title: string;
};

type Neighbours = {
  back: Slug | undefined;
  next: Slug | undefined;
  previous: Slug | undefined;
};

const NAV_ENTRIES: readonly Entry[] = NAV_GROUPS.flatMap(
  (group): readonly Entry[] => group.items
);

const COMPARISON_ENTRIES: readonly Entry[] = COMPARISON_PAGES;

const PAGE_ENTRIES: readonly Entry[] = [...NAV_ENTRIES, ...COMPARISON_ENTRIES];

const NAV_ORDER: readonly Slug[] = NAV_ENTRIES.map((entry) => entry.slug);

const COMPARISON_ORDER: readonly Slug[] = COMPARISON_ENTRIES.map(
  (entry) => entry.slug
);

const PAGE_ORDER: readonly Slug[] = PAGE_ENTRIES.map((entry) => entry.slug);

const isSlug = (candidate: string): candidate is Slug =>
  PAGE_ORDER.some((slug) => slug === candidate);

const titleOf = (slug: Slug): string =>
  PAGE_ENTRIES.find((entry) => entry.slug === slug)?.title ?? slug;

const parentOf = (slug: Slug): Slug | null =>
  COMPARISON_ORDER.includes(slug) ? COMPARISON_HUB : null;

const neighboursOf = (slug: Slug): Neighbours => {
  const compared = COMPARISON_ORDER.indexOf(slug);

  if (compared !== -1) {
    return {
      back: COMPARISON_HUB,
      next: COMPARISON_ORDER[compared + 1],
      previous: undefined,
    };
  }

  const at = NAV_ORDER.indexOf(slug);

  return {
    back: undefined,
    next: NAV_ORDER[at + 1],
    previous: NAV_ORDER[at - 1],
  };
};

const withAnchor = (path: string, anchor: string): string =>
  anchor === "" ? path : `${path}#${anchor}`;

const pagePath = (slug: Slug, anchor = ""): string =>
  withAnchor(`/docs/${slug}`, anchor);

const markdownPath = (slug: Slug, anchor = ""): string =>
  withAnchor(`/docs/${slug}.md`, anchor);

const slugParams = (): { slug: Slug }[] => PAGE_ORDER.map((slug) => ({ slug }));

export type { ComparisonSlug, Slug };
export {
  COMPARISON_ENTRIES,
  COMPARISON_ORDER,
  isSlug,
  markdownPath,
  NAV_ENTRIES,
  NAV_GROUPS,
  neighboursOf,
  PAGE_ENTRIES,
  PAGE_ORDER,
  pagePath,
  parentOf,
  slugParams,
  titleOf,
};
