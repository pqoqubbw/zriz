import type { MetadataRoute } from "next";

import { origin } from "@/lib/site";

const robots = (): MetadataRoute.Robots => ({
  rules: { allow: "/", disallow: "/md/", userAgent: "*" },
  sitemap: `${origin}/sitemap.xml`,
});

export default robots;
