import { markdownPath, pagePath } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

const SITE_ORIGIN = "https://zriz.dev";

const SITE_LINKS = {
  github: "https://github.com/pqoqubbw/zriz",
  npm: "https://www.npmjs.com/package/@zriz/react",
  x: "https://x.com/pqoqubbw",
} as const;

const SITE_DESCRIPTION =
  "zriz is a headless image cropper for React and Next.js, written in TypeScript. It crops avatars, profile pictures and cover photos with a straighten dial, pinch zoom and touch gestures, like the crop tool in iOS Photos.";

const HOME_TITLE = "zriz, a headless image cropper for React";

const SITE_OPEN_GRAPH = {
  locale: "en_US",
  siteName: "zriz",
  type: "website",
} as const;

const LLMS_URL = `${SITE_ORIGIN}/llms.txt`;

const LLMS_FULL_URL = `${SITE_ORIGIN}/llms-full.txt`;

const pageUrl = (slug: Slug, anchor = ""): string =>
  `${SITE_ORIGIN}${pagePath(slug, anchor)}`;

const markdownUrl = (slug: Slug, anchor = ""): string =>
  `${SITE_ORIGIN}${markdownPath(slug, anchor)}`;

export {
  HOME_TITLE,
  LLMS_FULL_URL,
  LLMS_URL,
  markdownUrl,
  pageUrl,
  SITE_DESCRIPTION,
  SITE_LINKS,
  SITE_OPEN_GRAPH,
  SITE_ORIGIN,
};
