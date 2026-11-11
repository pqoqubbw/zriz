import type { MetadataRoute } from "next";

import { RELEASES } from "@/content/releases";
import { PAGE_ORDER } from "@/lib/nav";
import { pageUrl } from "@/lib/site";

const sitemap = (): MetadataRoute.Sitemap =>
  PAGE_ORDER.map((slug) => ({
    lastModified: RELEASES[0]?.date,
    url: pageUrl(slug),
  }));

export default sitemap;
