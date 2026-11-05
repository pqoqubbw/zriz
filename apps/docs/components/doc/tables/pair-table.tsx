import { GridTable, PAIR_COLUMNS } from "@/components/doc/tables/grid-table";
import { Keys } from "@/components/doc/tables/keys";
import { Text } from "@/components/doc/text";
import { TableCell, TableRow } from "@/components/ui/table";
import { TABLE_HEADS } from "@/lib/doc/schema";
import type { KeyRow, NamedRow } from "@/lib/doc/schema";

type PairTableProps = {
  className: string;
  kind: keyof typeof TABLE_HEADS;
  rows: readonly (KeyRow | NamedRow)[];
};

const PairTable = ({ className, kind, rows }: PairTableProps) => (
  <GridTable
    className={className}
    head={TABLE_HEADS[kind].map((label) => ({ end: false, label }))}
    template={PAIR_COLUMNS}
  >
    {rows.map((row, i) => (
      <TableRow key={`${i}-${"keys" in row ? row.text : row.name}`}>
        {"keys" in row ? (
          <TableCell>
            <Keys keys={row.keys} />
          </TableCell>
        ) : (
          <TableCell kind="mono" tone="ink">
            {row.name}
          </TableCell>
        )}
        <TableCell kind="prose" tone="soft">
          <Text source={row.text} />
        </TableCell>
      </TableRow>
    ))}
  </GridTable>
);

export { PairTable };
