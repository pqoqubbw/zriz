import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site";

const robots = (): MetadataRoute.Robots => ({
  rules: { allow: "/", disallow: "/md/", userAgent: "*" },
  sitemap: `${SITE_ORIGIN}/sitemap.xml`,
});

export default robots;
