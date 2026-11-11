import { cva } from "class-variance-authority";

import { GridTable } from "@/components/doc/tables/grid-table";
import { Text } from "@/components/doc/text";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { TableCell, TableRow } from "@/components/ui/table";
import { LEVEL_WORDS } from "@/lib/doc/schema";
import type { BlockOf, Level, Verdict } from "@/lib/doc/schema";

type CompareTableProps = {
  block: BlockOf<"compare">;
  className: string;
};

type VerdictCellProps = {
  name: string;
  verdict: Verdict;
};

const COMPARE_COLUMNS = "9.5rem minmax(0, 1fr) minmax(0, 1fr)";

const LEVEL_ICONS = {
  no: "close",
  partly: "minus",
  yes: "check",
} as const satisfies Record<Level, IconName>;

const levelVariants = cva("flex items-center gap-1.5", {
  variants: {
    level: {
      no: "text-faint",
      partly: "text-soft",
      yes: "font-medium text-ink",
    } satisfies Record<Level, string>,
  },
});

const VerdictCell = ({ name, verdict: [level, note] }: VerdictCellProps) => (
  <TableCell kind="prose">
    <span
      aria-hidden="true"
      className="mt-1.5 block text-caption text-faint sm:hidden"
      data-markdown-ignore=""
    >
      {name}
    </span>
    <span className={levelVariants({ level })}>
      <Icon className="-ml-0.5 size-4 shrink-0" name={LEVEL_ICONS[level]} />
      {LEVEL_WORDS[level]}
    </span>
    {note !== undefined && (
      <span className="block text-caption text-muted">
        <Text source={note} />
      </span>
    )}
  </TableCell>
);

const CompareTable = ({ block, className }: CompareTableProps) => (
  <GridTable
    className={className}
    head={["Feature", ...block.names].map((label) => ({ end: false, label }))}
    template={COMPARE_COLUMNS}
  >
    {block.rows.map(([feature, theirs, ours]) => (
      <TableRow key={feature}>
        <TableCell kind="prose" tone="ink">
          <Text source={feature} />
        </TableCell>
        <VerdictCell name={block.names[0]} verdict={theirs} />
        <VerdictCell name={block.names[1]} verdict={ours} />
      </TableRow>
    ))}
  </GridTable>
);

export { CompareTable };
