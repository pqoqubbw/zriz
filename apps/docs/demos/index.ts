import dynamic from "next/dynamic";

export const demos = {
  "avatar/basic": dynamic(async () => await import("./avatar/basic")),
  "editor/full": dynamic(async () => await import("./editor/full")),
  "use-cover-scale/basic": dynamic(
    async () => await import("./use-cover-scale/basic")
  ),
} as const;

export type DemoName = keyof typeof demos;
