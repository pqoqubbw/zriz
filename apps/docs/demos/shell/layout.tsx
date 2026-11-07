import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { Icon } from "@/demos/shell/icon";

type StageProps = ComponentProps<"div">;

type ChipBarProps = ComponentProps<"div">;

type CornerProps = ComponentProps<"div"> & { side: "end" | "start" };

type ZoneProps = ComponentProps<"div"> & VariantProps<typeof zoneVariants>;

type ZoneRowProps = ComponentProps<"div"> &
  VariantProps<typeof zoneRowVariants>;

type ScaleProps = VariantProps<typeof scaleVariants> & {
  children: ReactNode;
  value: ReactNode;
};

type RulerProps = ComponentProps<"div"> & VariantProps<typeof rulerVariants>;

type ValueProps = {
  children: ReactNode;
  unit: string;
};

const SPINNER_STEPS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const spinnerBarVariants = cva("", {
  variants: {
    step: {
      0: "rotate-0 opacity-15",
      1: "rotate-45 opacity-27",
      2: "rotate-90 opacity-39",
      3: "rotate-135 opacity-51",
      4: "rotate-180 opacity-64",
      5: "rotate-225 opacity-76",
      6: "rotate-270 opacity-88",
      7: "rotate-315 opacity-100",
    },
  },
});

const stageVariants = cva(
  "relative h-95 w-full shrink-0 overflow-clip rounded-control bg-page @max-demo-wide:h-80"
);

const contentVariants = cva("absolute inset-0 data-dropping:invisible");

const cornerVariants = cva("flex gap-1.5");

const chipBarVariants = cva(
  "relative z-1 flex w-full shrink-0 justify-between pb-1 data-hidden:invisible"
);

const zoneVariants = cva(
  "flex w-full shrink-0 justify-center data-dim:opacity-40",
  {
    variants: {
      kind: {
        aspect: "pt-3 pb-2",
        dial: "pt-3 pb-2.25",
        row: "pt-3 pb-2",
        strip: "pt-3 pb-2.25",
        track: "pt-3 pb-2",
        zoom: "pt-3.5 pb-1.5",
      },
    },
  }
);

const zoneRowVariants = cva("flex items-end gap-3", {
  defaultVariants: { dial: false },
  variants: {
    dial: {
      false: "",
      true: "*:not-data-[slot=ruler]:not-data-[slot=scale]:mb-2",
    },
  },
});

const scaleVariants = cva("flex flex-col items-center", {
  defaultVariants: { kind: "zoom" },
  variants: { kind: { dial: "gap-2.25", zoom: "gap-1.5" } },
});

const rulerVariants = cva(
  "relative shrink-0 after:pointer-events-none after:absolute after:-inset-x-1.5 after:rounded-button has-focus-visible:after:inset-shadow-focus",
  {
    defaultVariants: { width: "dial" },
    variants: {
      width: {
        dial: "h-10 w-90 after:-top-0.5 after:-bottom-1 @max-demo-wide:w-50 @max-demo-narrow:w-44",
        zoom: "h-8 w-70 after:inset-y-0 @max-demo-wide:w-50 @max-demo-narrow:w-44",
      },
    },
  }
);

const Stage = ({ className, ...props }: StageProps) => (
  <div className={stageVariants({ className })} data-slot="stage" {...props} />
);

const StageContent = ({ className, ...props }: StageProps) => (
  <div
    className={contentVariants({ className })}
    data-slot="stage-content"
    {...props}
  />
);

const StageEdge = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 rounded-control inset-shadow-edge"
    data-slot="stage-edge"
  />
);

const ChipBar = ({ className, ...props }: ChipBarProps) => (
  <div
    className={chipBarVariants({ className })}
    data-slot="chip-bar"
    {...props}
  />
);

const Corner = ({ className, side, ...props }: CornerProps) => (
  <div
    className={cornerVariants({ className })}
    data-slot={`corner-${side}`}
    {...props}
  />
);

const Zone = ({ className, kind, ...props }: ZoneProps) => (
  <div
    className={zoneVariants({ className, kind })}
    data-slot="zone"
    data-zone={kind ?? undefined}
    {...props}
  />
);

const ZoneRow = ({ className, dial, ...props }: ZoneRowProps) => (
  <div
    className={zoneRowVariants({ className, dial })}
    data-slot="zone-row"
    {...props}
  />
);

const Scale = ({ children, kind, value }: ScaleProps) => (
  <div className={scaleVariants({ kind })} data-slot="scale">
    {value}
    {children}
  </div>
);

const Value = ({ children, unit }: ValueProps) => (
  <div
    className="relative flex justify-center text-control font-medium text-ink tabular-nums"
    data-slot="value"
  >
    {children}
    <span aria-hidden="true" className="absolute top-0 left-full">
      {unit}
    </span>
  </div>
);

const Ruler = ({ className, width, ...props }: RulerProps) => (
  <div
    className={rulerVariants({ className, width })}
    data-slot="ruler"
    {...props}
  />
);

const Spinner = () => (
  <div
    aria-hidden="true"
    className="spinner absolute top-1/2 left-1/2 size-5 -translate-1/2 animate-spinner motion-reduce:animate-none"
    data-slot="spinner"
  >
    {SPINNER_STEPS.map((step) => (
      <span className={spinnerBarVariants({ step })} key={step} />
    ))}
  </div>
);

const DropVeil = () => (
  <div
    className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 rounded-control text-control font-medium text-ink"
    data-slot="drop"
  >
    <Icon className="size-5 shrink-0" name="open-image" />
    Drop to open
  </div>
);

export {
  ChipBar,
  Corner,
  DropVeil,
  Ruler,
  Scale,
  Spinner,
  Stage,
  StageContent,
  StageEdge,
  Value,
  Zone,
  ZoneRow,
};
