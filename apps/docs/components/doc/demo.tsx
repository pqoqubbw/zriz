import { demos } from "@/demos/registry";
import type { DemoName } from "@/demos/registry";
import { cn } from "@/lib/cn";

const heights = { 320: "h-80", 454: "h-113.5" } as const;

export const Demo = ({
  className,
  name,
}: {
  className: string;
  name: DemoName;
}) => (
  <div
    className={cn(
      "rounded-demo bg-surface text-caption text-muted flex items-center justify-center",
      heights[demos[name].height],
      className
    )}
    data-demo={name}
    data-markdown-ignore=""
  >
    demo
  </div>
);
