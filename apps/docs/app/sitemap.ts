import type { MetadataRoute } from "next";

import { order, pathOf } from "@/lib/nav";
import { origin } from "@/lib/site";

const sitemap = (): MetadataRoute.Sitemap =>
  order.map((slug) => ({ url: `${origin}${pathOf(slug)}` }));

export default sitemap;
