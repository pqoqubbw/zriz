import type { NextConfig } from "next";

const markdown = [
  { key: "accept", type: "header", value: ".*text/markdown.*" },
] as const;

const config: NextConfig = {
  agentRules: false,
  headers: async () => [
    {
      headers: [{ key: "Vary", value: "Accept" }],
      source: "/docs/:slug",
    },
  ],
  poweredByHeader: false,
  reactCompiler: true,
  redirects: async () => [
    {
      destination: "/docs/introduction",
      missing: [...markdown],
      permanent: true,
      source: "/",
    },
    { destination: "/docs/introduction", permanent: true, source: "/docs" },
  ],
  rewrites: async () => ({
    afterFiles: [],
    beforeFiles: [
      { destination: "/md/introduction", has: [...markdown], source: "/" },
      { destination: "/md/:slug", source: "/docs/:slug.md" },
      { destination: "/md/:slug", has: [...markdown], source: "/docs/:slug" },
    ],
    fallback: [],
  }),
};

export default config;
