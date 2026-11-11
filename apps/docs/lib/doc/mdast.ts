import type {
  BlockContent,
  Blockquote,
  Code,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableRow,
  Text,
} from "mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

const HEADING_DEPTHS: readonly Heading["depth"][] = [1, 2, 3, 4, 5, 6];

const text = (value: string): Text => ({ type: "text", value });

const inlineCode = (value: string): InlineCode => ({
  type: "inlineCode",
  value,
});

const link = (url: string, label: string): Link => ({
  children: [text(label)],
  type: "link",
  url,
});

const paragraph = (children: PhrasingContent[]): Paragraph => ({
  children,
  type: "paragraph",
});

const blockquote = (children: BlockContent[]): Blockquote => ({
  children,
  type: "blockquote",
});

const heading = (depth: number, children: PhrasingContent[]): Heading => ({
  children,
  depth: HEADING_DEPTHS[Math.min(depth, 6) - 1] ?? 6,
  type: "heading",
});

const item = (children: BlockContent[]): ListItem => ({
  children,
  spread: false,
  type: "listItem",
});

const list = (items: ListItem[]): List => ({
  children: items,
  ordered: false,
  spread: false,
  type: "list",
});

const row = (cells: PhrasingContent[][]): TableRow => ({
  children: cells.map((children) => ({ children, type: "tableCell" })),
  type: "tableRow",
});

const table = (
  head: readonly string[],
  rows: PhrasingContent[][][]
): Table => ({
  children: [row(head.map((label) => [text(label)])), ...rows.map(row)],
  type: "table",
});

const fence = (lang: string, value: string): Code => ({
  lang,
  type: "code",
  value,
});

const printMarkdown = (children: RootContent[]): string =>
  toMarkdown({ children, type: "root" } satisfies Root, {
    bullet: "-",
    extensions: [gfmToMarkdown({ tablePipeAlign: false })],
    fences: true,
  }).replaceAll("\\://", "://");

export {
  blockquote,
  fence,
  heading,
  inlineCode,
  item,
  link,
  list,
  paragraph,
  printMarkdown,
  table,
  text,
};
