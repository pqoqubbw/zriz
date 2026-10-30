import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  headers: async () => [
    {
      headers: [
        {
          key: "Link",
          value: '</llms.txt>; rel="alternate"; type="text/plain"',
        },
      ],
      source: "/:path*",
    },
  ],
  pageExtensions: ["ts", "tsx", "mdx"],
  reactCompiler: true,
  rewrites: async () => ({
    afterFiles: [],
    beforeFiles: [
      { destination: "/md/:slug", source: "/docs/:slug.md" },
      {
        destination: "/md/:slug",
        has: [{ key: "accept", type: "header", value: ".*text/markdown.*" }],
        source: "/docs/:slug",
      },
    ],
    fallback: [],
  }),
  serverExternalPackages: ["fumadocs-typescript", "typescript"],
};

export default createMDX({
  options: {
    rehypePlugins: [
      [
        "@shikijs/rehype",
        {
          defaultColor: false,
          themes: {
            dark: "github-dark-default",
            light: "github-light-default",
          },
        },
      ],
    ],
    remarkPlugins: ["remark-gfm"],
  },
})(config);
