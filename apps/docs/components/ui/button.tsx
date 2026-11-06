import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { FocusTarget } from "@/components/ui/focus-target";
import { cn } from "@/lib/cn";

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

const buttonVariants = cva(
  "group relative flex shrink-0 items-center justify-center rounded-control",
  {
    defaultVariants: { size: "default", variant: "secondary" },
    variants: {
      size: {
        bar: "size-11",
        default: "h-8 px-3.5 after:absolute after:inset-x-0 after:-inset-y-1.5",
        icon: "size-6 after:absolute after:-inset-2.5",
      },
      variant: {
        ghost: "",
        secondary:
          "bg-white text-control font-medium shadow-button enabled:hover:bg-hover disabled:opacity-40 forced-colors:outline forced-colors:-outline-offset-1",
      },
    },
  }
);

const Button = ({
  children,
  className,
  size,
  variant,
  ...props
}: ButtonProps) => (
  <button
    type="button"
    className={cn(buttonVariants({ className, size, variant }))}
    data-slot="button"
    {...props}
  >
    {size === "bar" ? <FocusTarget>{children}</FocusTarget> : children}
  </button>
);

export type { ButtonProps };
export { Button };
