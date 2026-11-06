import type { ReactNode } from "react";

import { Tokens } from "@/components/doc/tables/tokens";
import { Text } from "@/components/doc/text";
import { Panel } from "@/components/ui/panel";
import { TableCell, TableRow } from "@/components/ui/table";
import type { MessageRow, PropRow } from "@/lib/doc/schema";
import { typeTokens } from "@/lib/doc/type-tokens";

type DefinitionListProps = {
  children: ReactNode;
  className: string;
  label: string;
};

type PropListProps = {
  className: string;
  label: string;
  rows: readonly PropRow[];
};

type MessageListProps = {
  className: string;
  label: string;
  rows: readonly MessageRow[];
};

const DefinitionList = ({
  children,
  className,
  label,
}: DefinitionListProps) => (
  <Panel className={className} layout="list">
    <TableRow as="div" kind="head">
      {label}
    </TableRow>
    <dl>{children}</dl>
  </Panel>
);

const NameGap = () => <span className="inline-block w-3"> </span>;

const PropList = ({ className, label, rows }: PropListProps) => (
  <DefinitionList className={className} label={label}>
    {rows.map((row, i) => (
      <TableRow as="div" key={`${i}-${row.name}`}>
        <TableCell as="dt" kind="mono">
          <span className="font-semibold">{row.name}</span>
          {row.type !== undefined && (
            <>
              <NameGap />
              <span className="contents text-muted">
                <Tokens items={typeTokens(row.type)} />
              </span>
            </>
          )}
          {row.required === true && (
            <>
              <NameGap />
              <span className="font-medium text-accent">Required</span>
            </>
          )}
          {row.default !== undefined && (
            <>
              {" "}
              <span className="text-muted">= {row.default}</span>
            </>
          )}
        </TableCell>
        <TableCell as="dd" kind="prose" tone="soft">
          <Text source={row.text} />
        </TableCell>
      </TableRow>
    ))}
  </DefinitionList>
);

const MessageList = ({ className, label, rows }: MessageListProps) => (
  <DefinitionList className={className} label={label}>
    {rows.map((row, i) => (
      <TableRow as="div" key={`${i}-${row.message}`}>
        <TableCell as="dt" kind="mono" tone="ink">
          <Tokens items={row.message.split(/(?<=[.,]) /u)} />
        </TableCell>
        <TableCell as="dd" kind="prose">
          <Text source={row.fix} />
        </TableCell>
      </TableRow>
    ))}
  </DefinitionList>
);

export { MessageList, PropList };
