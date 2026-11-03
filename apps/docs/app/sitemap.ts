import type { MetadataRoute } from "next";

import { PAGE_ORDER } from "@/lib/nav";
import { pageUrl } from "@/lib/site";

const sitemap = (): MetadataRoute.Sitemap =>
  PAGE_ORDER.map((slug) => ({ url: pageUrl(slug) }));

export default sitemap;
