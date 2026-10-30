import dynamic from "next/dynamic";

export const demos = {
  "use-cover-scale/basic": dynamic(
    async () => await import("./use-cover-scale/basic")
  ),
} as const;

export type DemoName = keyof typeof demos;
