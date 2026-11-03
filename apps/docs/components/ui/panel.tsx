import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type PanelProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof panelVariants> & {
    as?: "div" | "figure" | "table";
  };

const panelVariants = cva(
  "bg-surface max-sm:-mx-4 max-sm:rounded-none print:outline print:outline-edge forced-colors:outline forced-colors:-outline-offset-1",
  {
    defaultVariants: { layout: "block", radius: "panel" },
    variants: {
      layout: {
        block: "",
        box: "flex flex-col p-4",
        center: "flex items-center justify-center",
        list: "flex flex-col px-4",
        prompt: "flex items-start gap-3 py-4 pr-3 pl-4",
      },
      radius: { demo: "rounded-demo", panel: "rounded-panel" },
    },
  }
);

const Panel = ({
  as: Element = "div",
  className,
  layout,
  radius,
  ...props
}: PanelProps) => (
  <Element
    className={cn(panelVariants({ className, layout, radius }))}
    data-slot="panel"
    {...props}
  />
);

export type { PanelProps };
export { Panel };
