import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type KbdProps = ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>;

const kbdVariants = cva(
  "flex h-5 min-w-5 items-center justify-center rounded-kbd bg-key font-sans text-small font-medium print:outline print:outline-edge forced-colors:outline forced-colors:-outline-offset-1",
  {
    defaultVariants: { wide: false },
    variants: { wide: { false: "", true: "px-1.5" } },
  }
);

const Kbd = ({ className, wide, ...props }: KbdProps) => (
  <kbd
    className={cn(kbdVariants({ className, wide }))}
    data-slot="kbd"
    {...props}
  />
);

export type { KbdProps };
export { Kbd };
