import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type FocusTargetProps = ComponentProps<"span">;

const FocusTarget = ({ className, ...props }: FocusTargetProps) => (
  <span
    className={cn("flex group-focus-visible:corners", className)}
    data-slot="focus-target"
    {...props}
  />
);

export type { FocusTargetProps };
export { FocusTarget };
