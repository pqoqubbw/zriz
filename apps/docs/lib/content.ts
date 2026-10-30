import type { MDXContent } from "mdx/types";

export const content: Record<string, () => Promise<{ default: MDXContent }>> = {
  accessibility: async () => await import("@/content/accessibility.mdx"),
  editor: async () => await import("@/content/editor.mdx"),
  "getting-started": async () => await import("@/content/getting-started.mdx"),
  images: async () => await import("@/content/images.mdx"),
  styling: async () => await import("@/content/styling.mdx"),
  "use-cover-scale": async () => await import("@/content/use-cover-scale.mdx"),
  vanilla: async () => await import("@/content/vanilla.mdx"),
};
