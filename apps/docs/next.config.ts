import type { NextConfig } from "next";

import { pagePath } from "./lib/nav";

const ACCEPTS_MARKDOWN = [
  { key: "accept", type: "header", value: ".*text/markdown.*" },
] as const;

const config: NextConfig = {
  agentRules: false,
  headers: async () => [
    {
      headers: [{ key: "Vary", value: "Accept" }],
      source: "/docs/:slug",
    },
    {
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
      source: "/:path*",
    },
  ],
  poweredByHeader: false,
  reactCompiler: true,
  redirects: async () => [
    {
      destination: pagePath("introduction"),
      missing: [...ACCEPTS_MARKDOWN],
      permanent: true,
      source: "/",
    },
    { destination: pagePath("introduction"), permanent: true, source: "/docs" },
  ],
  rewrites: async () => ({
    afterFiles: [],
    beforeFiles: [
      {
        destination: "/md/introduction",
        has: [...ACCEPTS_MARKDOWN],
        source: "/",
      },
      { destination: "/md/:slug", source: "/docs/:slug.md" },
      {
        destination: "/md/:slug",
        has: [...ACCEPTS_MARKDOWN],
        source: "/docs/:slug",
      },
    ],
    fallback: [],
  }),
};

export default config;
