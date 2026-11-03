import { cva } from "class-variance-authority";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { Text } from "@/components/doc/text";
import { cn } from "@/lib/cn";
import { withoutStop } from "@/lib/doc/inline";
import { heads, isArrows, typeTokens } from "@/lib/doc/schema";
import type {
  BlockOf,
  Chord,
  Column,
  KeyRow,
  MessageRow,
  NamedRow,
  PropRow,
} from "@/lib/doc/schema";
import { bleed } from "@/lib/styles";

const glyphs: Record<string, string> = {
  alt: "⌥",
  down: "↓",
  enter: "↵",
  left: "←",
  right: "→",
  shift: "⇧",
  up: "↑",
};

const arrows = ["left", "up", "right", "down"];

const key = cva(
  "rounded-kbd bg-key text-small flex h-5 min-w-5 items-center justify-center font-sans font-medium",
  { variants: { wide: { false: "", true: "px-1.5" } } }
);

const Glyph = ({ name }: { name: string }) => (
  <kbd className={key({ wide: false })}>
    <span aria-hidden="true">{glyphs[name]}</span>
    <span className="sr-only">{name}</span>
  </kbd>
);

const Key = ({ name }: { name: string }) => {
  if (isArrows(name)) {
    return (
      <>
        {arrows.map((arrow) => (
          <kbd aria-hidden="true" className={key({ wide: false })} key={arrow}>
            {glyphs[arrow]}
          </kbd>
        ))}
        <span className="sr-only">arrow keys</span>
      </>
    );
  }
  if (glyphs[name] !== undefined) {
    return <Glyph name={name} />;
  }
  return <kbd className={key({ wide: name.length > 1 })}>{name}</kbd>;
};

export const Keys = ({ keys }: { keys: readonly Chord[] }) => (
  <span className="flex min-h-5.5 flex-wrap content-start items-center gap-1 pt-px">
    {keys.map((chord, i) => (
      <Fragment key={chord.join("+")}>
        {i > 0 && <span className="sr-only">or</span>}
        {chord.map((name, j) => (
          <Fragment key={name}>
            {j > 0 && <span className="text-small text-faint">+</span>}
            <Key name={name} />
          </Fragment>
        ))}
      </Fragment>
    ))}
  </span>
);

const Tokens = ({ items }: { items: readonly string[] }) =>
  items.map((item, i) => (
    <Fragment key={`${i}-${item}`}>
      {i > 0 && " "}
      <span>{item}</span>
    </Fragment>
  ));

const tokenFlow =
  "*:whitespace-pre-wrap *:[overflow-wrap:break-word] max-sm:*:[overflow-wrap:anywhere]";

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
    return "12.5rem minmax(0, 1fr)";
  }
  const marked = columns.findIndex((column) => column.fill === true);
  const fill = marked === -1 ? columns.length - 1 : marked;
  return columns
    .map((_, i) =>
      i === fill ? "minmax(12.5rem, 1fr)" : "fit-content(12.5rem)"
    )
    .join(" ");
};

const panel = cn(
  "rounded-panel bg-surface flex flex-col px-4 text-left sm:grid sm:gap-x-4",
  bleed
);
const headRow =
  "col-span-full flex pt-2 pb-1.75 text-caption text-muted sm:grid sm:grid-cols-subgrid";
const bodyRow =
  "col-span-full flex flex-col gap-y-0.5 py-2.75 inset-shadow-rule sm:grid sm:grid-cols-subgrid sm:gap-y-0";
const continued =
  "col-span-full flex flex-col gap-y-0.5 pb-2.75 sm:grid sm:grid-cols-subgrid sm:gap-y-0";

interface GridRow {
  cells: ReactNode[];
  continues: boolean;
  fix?: ReactNode;
  key: string;
}

const GridTable = ({
  className,
  fix,
  head,
  rows,
  template,
}: {
  className: string;
  fix?: string | undefined;
  head: { end: boolean; label: string }[];
  rows: GridRow[];
  template: string;
}) => (
  <table
    className={cn(panel, className)}
    style={{ gridTemplateColumns: template }}
  >
    <thead className="contents">
      <tr className={headRow}>
        {head.map((cell, i) => (
          <th
            className={cn(
              "font-book",
              i > 0 && "max-sm:sr-only",
              cell.end && "sm:text-right"
            )}
            key={cell.label}
            scope="col"
          >
            {cell.label}
          </th>
        ))}
        {fix !== undefined && (
          <th className="sr-only" scope="col">
            {fix}
          </th>
        )}
      </tr>
    </thead>
    <tbody className="contents">
      {rows.map((row) => (
        <tr className={row.continues ? continued : bodyRow} key={row.key}>
          {row.cells}
          {row.fix !== undefined && (
            <td className="text-cell col-start-2 -col-end-1 sm:mt-1.5">
              {row.fix}
            </td>
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

const ColumnName = ({ text }: { text: string }) => (
  <span
    aria-hidden="true"
    className="text-small text-faint block sm:hidden"
    data-markdown-ignore=""
  >
    {text}
  </span>
);

const cell = cva("min-w-0", {
  compoundVariants: [{ class: "font-medium", kind: "mono", tone: "ink" }],
  variants: {
    end: { false: "", true: "sm:text-right" },
    kind: {
      mono: cn("text-cell-mono font-mono", tokenFlow),
      prose: "text-cell",
    },
    tone: { ink: "text-ink", muted: "text-muted", soft: "text-soft" },
  },
});

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

const cellOf = (
  column: Column,
  first: boolean,
  muted: boolean,
  value: string,
  labelled: boolean
) => (
  <td
    className={cell({
      end: column.align === "end",
      kind: column.kind,
      tone: toneOf(column, first, muted),
    })}
    key={column.label}
  >
    {labelled && !first && <ColumnName text={column.label} />}
    {column.kind === "mono" ? (
      <Tokens items={typeTokens(value, true)} />
    ) : (
      <Text source={withoutStop(value)} />
    )}
  </td>
);

export const Table = ({
  block,
  className,
}: {
  block: BlockOf<"table">;
  className: string;
}) => {
  const { columns, fix, rows } = block;
  return (
    <GridTable
      className={className}
      fix={fix}
      head={columns.map((column) => ({
        end: column.align === "end",
        label: column.label,
      }))}
      rows={rows.map((row, r) => ({
        cells: columns.map((column, i) =>
          cellOf(
            column,
            i === 0,
            fix !== undefined,
            row[i] ?? "",
            columns.length > 2
          )
        ),
        continues: row[0] === "" && r > 0,
        ...(fix === undefined
          ? {}
          : { fix: <Text source={withoutStop(row[columns.length] ?? "")} /> }),
        key: `${r}-${row[0]}`,
      }))}
      template={templateOf(columns, fix !== undefined)}
    />
  );
};

const nameTemplate = "12.5rem minmax(0, 1fr)";

export const NamedTable = ({
  className,
  kind,
  rows,
}: {
  className: string;
  kind: "attrs" | "variables";
  rows: readonly NamedRow[];
}) => (
  <GridTable
    className={className}
    head={heads[kind].map((label) => ({ end: false, label }))}
    rows={rows.map((row) => ({
      cells: [
        <td className="text-cell-mono font-mono font-medium" key="name">
          {row.name}
        </td>,
        <td className="text-cell text-soft" key="text">
          <Text source={withoutStop(row.text)} />
        </td>,
      ],
      continues: false,
      key: row.name,
    }))}
    template={nameTemplate}
  />
);

export const KeyTable = ({
  className,
  rows,
}: {
  className: string;
  rows: readonly KeyRow[];
}) => (
  <GridTable
    className={className}
    head={heads.keys.map((label) => ({ end: false, label }))}
    rows={rows.map((row) => ({
      cells: [
        <td key="keys">
          <Keys keys={row.keys} />
        </td>,
        <td className="text-cell text-soft" key="text">
          <Text source={withoutStop(row.text)} />
        </td>,
      ],
      continues: false,
      key: row.text,
    }))}
    template={nameTemplate}
  />
);

const list = cn("rounded-panel bg-surface flex flex-col px-4", bleed);
const listHead = "pt-2 pb-1.75 text-caption text-muted";
const listRow = "flex flex-col gap-0.5 py-2.75 inset-shadow-rule";
const gapAfterName = "inline-block w-3";

export const Signatures = ({
  className,
  label,
  rows,
}: {
  className: string;
  label: string;
  rows: readonly PropRow[];
}) => (
  <div className={cn(list, className)}>
    <div className={listHead}>{label}</div>
    <dl>
      {rows.map((row) => (
        <div className={listRow} key={row.name}>
          <dt className={cn("text-cell-mono font-mono", tokenFlow)}>
            <span className="font-semibold">{row.name}</span>
            {row.type !== undefined && (
              <>
                <span className={gapAfterName}> </span>
                <span className="text-muted contents">
                  <Tokens items={typeTokens(row.type)} />
                </span>
              </>
            )}
            {row.required === true && (
              <>
                <span className={gapAfterName}> </span>
                <span className="text-accent font-medium">required</span>
              </>
            )}
            {row.default !== undefined && (
              <>
                {" "}
                <span className="text-muted">= {row.default}</span>
              </>
            )}
          </dt>
          <dd className="text-cell text-soft">
            <Text source={withoutStop(row.text)} />
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

export const Messages = ({
  className,
  label,
  rows,
}: {
  className: string;
  label: string;
  rows: readonly MessageRow[];
}) => (
  <div className={cn(list, className)}>
    <div className={listHead}>{label}</div>
    <dl>
      {rows.map((row) => (
        <div className={listRow} key={row.message}>
          <dt className={cn("text-cell-mono font-mono font-medium", tokenFlow)}>
            <Tokens items={row.message.split(/(?<=[.,]) /u)} />
          </dt>
          <dd className="text-cell">
            <Text source={withoutStop(row.fix)} />
          </dd>
        </div>
      ))}
    </dl>
  </div>
);
