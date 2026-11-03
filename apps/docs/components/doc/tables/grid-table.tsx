import type { ReactNode } from "react";

import { Tokens } from "@/components/doc/tables/tokens";
import { Text } from "@/components/doc/text";
import { Panel } from "@/components/ui/panel";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { BlockOf, Column } from "@/lib/doc/schema";
import { typeTokens } from "@/lib/doc/type-tokens";

type HeadCell = {
  end: boolean;
  label: string;
};

type GridTableProps = {
  children: ReactNode;
  className: string;
  fix?: string | undefined;
  head: readonly HeadCell[];
  template: string;
};

type ColumnNameProps = {
  text: string;
};

type DataCellProps = {
  column: Column;
  first: boolean;
  labelled: boolean;
  muted: boolean;
  value: string;
};

type TableBlockProps = {
  block: BlockOf<"table">;
  className: string;
};

const PAIR_COLUMNS = "12.5rem minmax(0, 1fr)";

const GridTable = ({
  children,
  className,
  fix,
  head,
  template,
}: GridTableProps) => (
  <Panel
    as="table"
    className={cn("text-left sm:grid sm:gap-x-4", className)}
    layout="list"
    style={{ gridTemplateColumns: template }}
  >
    <thead className="contents">
      <TableRow kind="head">
        {head.map((cell, i) => (
          <TableCell
            as="th"
            className={cn(i > 0 && "max-sm:sr-only")}
            end={cell.end}
            key={cell.label}
            kind="head"
            scope="col"
          >
            {cell.label}
          </TableCell>
        ))}
        {fix !== undefined && (
          <TableCell as="th" className="sr-only" kind="head" scope="col">
            {fix}
          </TableCell>
        )}
      </TableRow>
    </thead>
    <tbody className="contents">{children}</tbody>
  </Panel>
);

const ColumnName = ({ text }: ColumnNameProps) => (
  <span
    aria-hidden="true"
    className="block text-small text-faint sm:hidden"
    data-markdown-ignore=""
  >
    {text}
  </span>
);

const toneOf = (
  column: Column,
  first: boolean,
  muted: boolean
): "ink" | "muted" | "soft" => {
  if (first || (column.kind === "prose" && column.align === "end")) {
    return "ink";
  }

  return column.kind === "mono" || muted ? "muted" : "soft";
};

const DataCell = ({ column, first, labelled, muted, value }: DataCellProps) => (
  <TableCell
    end={column.align === "end"}
    kind={column.kind}
    tone={toneOf(column, first, muted)}
  >
    {labelled && !first && <ColumnName text={column.label} />}
    {column.kind === "mono" ? (
      <Tokens items={typeTokens(value, true)} />
    ) : (
      <Text source={value} />
    )}
  </TableCell>
);

const templateOf = (columns: readonly Column[], fix: boolean): string => {
  if (columns.some((column) => column.width !== undefined)) {
    return columns
      .map((column) =>
        column.width === undefined
          ? "minmax(0, 1fr)"
          : `${column.width / 16}rem`
      )
      .join(" ");
  }

  if (columns.length === 2 && !fix) {
    return PAIR_COLUMNS;
  }

  const marked = columns.findIndex((column) => column.fill === true);
  const fill = marked === -1 ? columns.length - 1 : marked;

  return columns
    .map((_, i) =>
      i === fill ? "minmax(12.5rem, 1fr)" : "fit-content(12.5rem)"
    )
    .join(" ");
};

const TableBlock = ({ block, className }: TableBlockProps) => {
  const { columns, fix, rows } = block;

  return (
    <GridTable
      className={className}
      fix={fix}
      head={columns.map((column) => ({
        end: column.align === "end",
        label: column.label,
      }))}
      template={templateOf(columns, fix !== undefined)}
    >
      {rows.map((row, r) => (
        <TableRow
          key={`${r}-${row[0]}`}
          kind={row[0] === "" && r > 0 ? "continued" : "body"}
        >
          {columns.map((column, i) => (
            <DataCell
              column={column}
              first={i === 0}
              key={column.label}
              labelled={columns.length > 2}
              muted={fix !== undefined}
              value={row[i] ?? ""}
            />
          ))}
          {fix !== undefined && (
            <TableCell
              className="col-start-2 -col-end-1 sm:mt-1.5"
              kind="prose"
            >
              <Text source={row[columns.length] ?? ""} />
            </TableCell>
          )}
        </TableRow>
      ))}
    </GridTable>
  );
};

export { GridTable, PAIR_COLUMNS, TableBlock };
