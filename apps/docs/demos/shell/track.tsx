import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";

type TrackProps = ComponentProps<"div">;

const trackItemVariants = cva(
  "relative flex h-7 shrink-0 items-center rounded-button px-2 text-control font-medium text-muted tabular-nums select-none data-checked:bg-white data-checked:text-ink data-checked:shadow-raised",
  {
    defaultVariants: { live: true },
    variants: {
      live: {
        false: "",
        radio:
          "cursor-pointer before:absolute before:inset-x-0 before:-inset-y-2 not-data-checked:hover:bg-key not-data-checked:hover:text-ink not-data-checked:active:bg-press not-data-checked:active:text-ink has-focus-visible:text-ink has-focus-visible:inset-shadow-focus data-checked:has-focus-visible:shadow-lift",
        true: "cursor-pointer before:absolute before:inset-x-0 before:-inset-y-2 not-data-checked:hover:bg-key not-data-checked:hover:text-ink focus-visible:text-ink focus-visible:inset-shadow-focus focus-visible:corners-none not-data-checked:active:bg-press not-data-checked:active:text-ink data-checked:focus-visible:shadow-lift",
      },
    },
  }
);

const trackVariants = cva(
  "flex h-8 shrink-0 items-center gap-0.5 rounded-control bg-fill p-0.5"
);

const Track = ({ className, ...props }: TrackProps) => (
  <div className={trackVariants({ className })} data-slot="track" {...props} />
);

export type { TrackProps };
export { Track, trackItemVariants, trackVariants };
