import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type TableRowProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof tableRowVariants> & {
    as?: "div" | "li" | "tr";
  };

type TableCellProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof tableCellVariants> & {
    as?: "dd" | "dt" | "td" | "th";
    scope?: "col" | "row";
  };

const tableRowVariants = cva("", {
  compoundVariants: [
    { class: "flex flex-col gap-y-0.5", kind: ["body", "continued"] },
    { as: "tr", class: "sm:gap-y-0", kind: ["body", "continued"] },
  ],
  defaultVariants: { as: "tr", kind: "body" },
  variants: {
    as: {
      div: "",
      li: "",
      tr: "col-span-full flex sm:grid sm:grid-cols-subgrid",
    },
    kind: {
      body: "py-2.75 inset-shadow-rule forced-colors:border-t",
      continued: "pb-2.75",
      head: "pt-2 pb-1.75 text-caption text-muted",
    },
  },
});

const tableCellVariants = cva("", {
  compoundVariants: [{ class: "font-medium", kind: "mono", tone: "ink" }],
  defaultVariants: { end: false },
  variants: {
    end: { false: "", true: "tabular-nums sm:text-right" },
    kind: {
      head: "font-book",
      mono: "min-w-0 font-mono text-cell-mono *:wrap-break-word *:whitespace-pre-wrap max-sm:*:wrap-anywhere",
      prose: "min-w-0 text-cell",
    },
    tone: { ink: "text-ink", muted: "text-muted", soft: "text-soft" },
  },
});

const TableRow = ({
  as: Element = "tr",
  className,
  kind,
  ...props
}: TableRowProps) => (
  <Element
    className={cn(tableRowVariants({ as: Element, className, kind }))}
    data-slot="table-row"
    {...props}
  />
);

const TableCell = ({
  as: Element = "td",
  className,
  end,
  kind,
  tone,
  ...props
}: TableCellProps) => (
  <Element
    className={cn(tableCellVariants({ className, end, kind, tone }))}
    data-slot="table-cell"
    {...props}
  />
);

export { TableCell, TableRow };
