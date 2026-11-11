import { Text } from "@/components/doc/text";
import { Panel } from "@/components/ui/panel";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { BlockOf } from "@/lib/doc/schema";

type EntryListProps = {
  block: BlockOf<"entries">;
  className: string;
};

const EntryList = ({ block, className }: EntryListProps) => (
  <Panel as="ul" className={className} layout="list">
    {block.rows.map((row, i) => (
      <TableRow
        as="li"
        className={cn(i === 0 && "inset-shadow-none")}
        key={row.title}
      >
        <span className="flex items-baseline justify-between gap-4 text-cell">
          <span className="min-w-0 font-medium text-ink">
            <Text source={row.title} />
          </span>
          {row.meta !== undefined && (
            <span className="shrink-0 text-muted tabular-nums">{row.meta}</span>
          )}
        </span>
        <span className="text-cell text-soft">
          <Text source={row.text} />
        </span>
      </TableRow>
    ))}
  </Panel>
);

export { EntryList };
