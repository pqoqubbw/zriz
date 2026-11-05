import type { NextConfig } from "next";

import { pagePath } from "./lib/nav";

const ACCEPTS_MARKDOWN = [
  { key: "accept", type: "header", value: ".*text/markdown.*" },
] as const;

const DEV = process.env.NODE_ENV === "development";

const POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  `style-src 'self'${DEV ? " 'unsafe-inline'" : ""}`,
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "worker-src blob:",
  `connect-src 'self' blob: data:${DEV ? " ws:" : ""}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const config: NextConfig = {
  agentRules: false,
  headers: async () => [
    {
      headers: [{ key: "Vary", value: "Accept" }],
      source: "/docs/:slug",
    },
    {
      headers: [
        { key: "Content-Security-Policy", value: POLICY },
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
