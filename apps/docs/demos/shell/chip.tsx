import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { Icon } from "@/demos/shell/icon";
import type { IconName } from "@/demos/shell/icon";

type ChipContentProps = VariantProps<typeof chipLabelVariants> & {
  icon: IconName;
  label: string;
};

const chipVariants = cva(
  "relative flex h-8 shrink-0 items-center rounded-control bg-white text-control font-medium select-none",
  {
    compoundVariants: [
      {
        className: "not-aria-disabled:hover:bg-secondary-hover",
        live: true,
        tone: "default",
      },
      { className: "hover:bg-error-hover", live: true, tone: "error" },
    ],
    defaultVariants: { live: true, size: "label", tone: "default" },
    variants: {
      live: {
        false: "",
        true: "before:absolute before:-inset-1.5 focus-visible:shadow-lift focus-visible:inset-shadow-focus focus-visible:corners-none aria-disabled:cursor-default aria-disabled:*:opacity-40 data-dim:*:opacity-40 data-pristine:hidden",
      },
      size: {
        collapse:
          "pr-2 pl-2.5 @max-demo:w-8 @max-demo:justify-center @max-demo:p-0",
        fixed: "w-27 justify-center @max-demo:w-8",
        icon: "w-8 justify-center",
        label: "pr-2 pl-2.5",
      },
      tone: {
        default: "text-button-ink shadow-secondary *:first:text-button-icon",
        error: "text-error shadow-error",
      },
    },
  }
);

const chipLabelVariants = cva("px-1", {
  defaultVariants: { collapse: false },
  variants: { collapse: { false: "", true: "@max-demo:hidden" } },
});

const ChipContent = ({ collapse, icon, label }: ChipContentProps) => (
  <>
    <Icon className="size-5 shrink-0" name={icon} />
    <span className={chipLabelVariants({ collapse })}>{label}</span>
  </>
);

export { ChipContent, chipVariants };
