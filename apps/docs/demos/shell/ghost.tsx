import { cva } from "class-variance-authority";

const ghostVariants = cva(
  "relative flex size-8 shrink-0 items-center justify-center rounded-button bg-tertiary text-button-icon aria-disabled:*:opacity-40 data-disabled:*:opacity-40",
  {
    defaultVariants: { live: true },
    variants: {
      live: {
        false: "",
        true: "before:absolute before:-inset-1.5 not-aria-disabled:not-data-disabled:hover:bg-tertiary-hover focus-visible:inset-shadow-focus focus-visible:corners-none aria-disabled:cursor-default data-disabled:cursor-default",
      },
    },
  }
);

export { ghostVariants };
