import type { MDXContent } from "mdx/types";

export const content: Record<string, () => Promise<{ default: MDXContent }>> = {
  "use-cover-scale": async () => await import("@/content/use-cover-scale.mdx"),
};
