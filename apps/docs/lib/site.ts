import { markdownPath, pagePath } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

const SITE_ORIGIN = "https://zriz.dev";

const SITE_LINKS = {
  github: "https://github.com/pqoqubbw/zriz",
  npm: "https://www.npmjs.com/package/@zriz/react",
} as const;

const SITE_DESCRIPTION =
  "zriz is an image cropper for react with a straighten dial, like the crop tool in ios photos.";

const LLMS_URL = `${SITE_ORIGIN}/llms.txt`;

const LLMS_FULL_URL = `${SITE_ORIGIN}/llms-full.txt`;

const pageUrl = (slug: Slug, anchor = ""): string =>
  `${SITE_ORIGIN}${pagePath(slug, anchor)}`;

const markdownUrl = (slug: Slug, anchor = ""): string =>
  `${SITE_ORIGIN}${markdownPath(slug, anchor)}`;

export {
  LLMS_FULL_URL,
  LLMS_URL,
  markdownUrl,
  pageUrl,
  SITE_DESCRIPTION,
  SITE_LINKS,
  SITE_ORIGIN,
};
