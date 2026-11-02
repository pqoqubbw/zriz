import type {
  BlockContent,
  Heading,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  TableRow,
} from "mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

import { piecesOf, withoutStop } from "@/lib/doc/inline";
import { heads, isArrows } from "@/lib/doc/schema";
import type { Block, BlockOf, Chord, Kind } from "@/lib/doc/schema";
import { languageOf, textOf } from "@/lib/doc/snippets";
import { docs } from "@/lib/docs";
import { entries, groups, pathOf, titleOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";
import { origin } from "@/lib/site";

type Depth = Heading["depth"];

const urlOf = (slug: Slug, anchor = ""): string =>
  `${origin}${pathOf(slug)}.md${anchor === "" ? "" : `#${anchor}`}`;

const phrasing = (source: string): PhrasingContent[] =>
  piecesOf(source).map((piece) => {
    if (piece.kind === "code") {
      return { type: "inlineCode", value: piece.text };
    }
    if (piece.kind === "link") {
      return {
        children: [{ type: "text", value: piece.text }],
        type: "link",
        url: urlOf(piece.slug, piece.anchor),
      };
    }
    return { type: "text", value: piece.text };
  });

const paragraph = (source: string): BlockContent => ({
  children: phrasing(source),
  type: "paragraph",
});

const depths: readonly Depth[] = [1, 2, 3, 4, 5, 6];

const heading = (depth: number, children: PhrasingContent[]): RootContent => ({
  children,
  depth: depths[Math.min(depth, 6) - 1] ?? 6,
  type: "heading",
});

const code = (value: string): PhrasingContent => ({
  type: "inlineCode",
  value,
});

const row = (cells: PhrasingContent[][]): TableRow => ({
  children: cells.map((children) => ({ children, type: "tableCell" })),
  type: "tableRow",
});

const table = (
  head: readonly string[],
  rows: PhrasingContent[][][]
): RootContent => ({
  children: [
    row(head.map((label) => [{ type: "text", value: label }])),
    ...rows.map(row),
  ],
  type: "table",
});

const item = (children: BlockContent[]): ListItem => ({
  children,
  spread: false,
  type: "listItem",
});

const list = (items: ListItem[]): RootContent => ({
  children: items,
  ordered: false,
  spread: false,
  type: "list",
});

const chordPhrasing = (chords: readonly Chord[]): PhrasingContent[] =>
  chords.flatMap((chord, i) => [
    ...(i > 0 ? [{ type: "text" as const, value: " or " }] : []),
    ...chord.flatMap((name, j) => [
      ...(j > 0 ? [{ type: "text" as const, value: " + " }] : []),
      code(isArrows(name) ? "arrow keys" : name),
    ]),
  ]);

type Nested = (blocks: readonly Block[], depth: number) => RootContent[];

type Converter<K extends Kind> = (
  block: BlockOf<K>,
  depth: number,
  nested: Nested
) => RootContent[];

const converters: { [K in Kind]: Converter<K> } = {
  actions: () => [],
  attrs: (block) => [
    table(
      heads.attrs,
      block.rows.map((entry) => [
        [code(entry.name)],
        phrasing(withoutStop(entry.text)),
      ])
    ),
  ],
  caption: (block, depth) => [heading(depth, [code(block.text)])],
  code: (block) => [
    { lang: languageOf(block.file).fence, type: "code", value: textOf(block) },
  ],
  controls: (block) => [
    list(
      block.controls.map((control) => {
        let text = "on or off";
        if (control.type === "choice") {
          text = control.options.map((option) => `\`${option}\``).join(", ");
        } else if (control.type === "range") {
          text = `from ${control.min}${control.unit} to ${control.max}${control.unit}`;
        }
        return item([paragraph(`\`${control.name}\`: ${text}`)]);
      })
    ),
  ],
  demo: (block) => [
    paragraph(`the demo runs on the page at ${origin}${pathOf(block.name)}.`),
  ],
  excerpt: (block) => [
    { lang: languageOf(block.file).fence, type: "code", value: textOf(block) },
  ],
  intro: (block, depth, nested) => nested(block.blocks, depth),
  keys: (block) => [
    table(
      heads.keys,
      block.rows.map((entry) => [
        chordPhrasing(entry.keys),
        phrasing(withoutStop(entry.text)),
      ])
    ),
  ],
  list: (block) => [list(block.items.map((entry) => item([paragraph(entry)])))],
  log: (block) => [
    {
      lang: "text",
      type: "code",
      value: block.lines
        .map((line) => `${line.time}  ${line.event}`)
        .join("\n"),
    },
  ],
  messages: (block) => [
    list(
      block.rows.map((entry) =>
        item([
          { children: [code(entry.message)], type: "paragraph" },
          paragraph(withoutStop(entry.fix)),
        ])
      )
    ),
  ],
  p: (block) => [paragraph(block.text)],
  part: (block, depth, nested) => [
    heading(depth, [code(block.name)]),
    ...(block.text === "" ? [] : [paragraph(block.text)]),
    ...nested(block.blocks, depth + 1),
  ],
  prompt: (block) => [{ lang: "text", type: "code", value: block.text }],
  props: (block) => [
    list(
      block.rows.map((entry) => {
        const line: PhrasingContent[] = [code(entry.name)];
        if (entry.type !== undefined) {
          line.push({ type: "text", value: " " }, code(entry.type));
        }
        if (entry.required === true) {
          line.push({ type: "text", value: " required" });
        }
        if (entry.default !== undefined) {
          line.push({ type: "text", value: " = " }, code(entry.default));
        }
        return item([
          { children: line, type: "paragraph" },
          paragraph(withoutStop(entry.text)),
        ]);
      })
    ),
  ],
  qa: (block, depth, nested) => [
    heading(depth, [{ type: "text", value: block.question }]),
    ...nested(block.blocks, depth + 1),
  ],
  section: (block, depth, nested) => [
    heading(depth, [{ type: "text", value: block.title }]),
    ...nested(block.blocks, depth + 1),
  ],
  sub: (block, depth) => [heading(depth, phrasing(block.text))],
  table: (block) => {
    const head = block.columns.map((column) => column.label);
    return [
      table(
        head,
        block.rows.map((cells) =>
          head.map((_, i) => {
            const value = cells[i] ?? "";
            if (block.columns[i]?.kind === "mono") {
              return [code(value)];
            }
            if (block.fix !== undefined && i === head.length - 1) {
              return phrasing(
                `${withoutStop(value)}. ${withoutStop(cells[head.length] ?? "")}`
              );
            }
            return phrasing(withoutStop(value));
          })
        )
      ),
    ];
  },
  variables: (block) => [
    table(
      heads.variables,
      block.rows.map((entry) => [
        [code(entry.name)],
        phrasing(withoutStop(entry.text)),
      ])
    ),
  ],
};

const convert = <K extends Kind>(
  block: BlockOf<K>,
  depth: number
): RootContent[] =>
  converters[block.kind](block, depth, (blocks, level) =>
    blocks.flatMap((child) => convert(child, level))
  );

const print = (children: RootContent[]): string =>
  toMarkdown({ children, type: "root" } satisfies Root, {
    bullet: "-",
    extensions: [gfmToMarkdown({ tablePipeAlign: false })],
    fences: true,
  });

const llmsLink = (): RootContent => ({
  children: [
    {
      children: [
        {
          children: [{ type: "text", value: "llms.txt" }],
          type: "link",
          url: `${origin}/llms.txt`,
        },
      ],
      type: "paragraph",
    },
  ],
  type: "blockquote",
});

export const pageMarkdown = (slug: Slug, full = false): string => {
  const doc = docs[slug];
  return print([
    heading(1, [{ type: "text", value: titleOf(slug) }]),
    full ? paragraph(`source: ${origin}${pathOf(slug)}.md`) : llmsLink(),
    paragraph(doc.lede),
    ...doc.blocks.flatMap((block: Block) => convert(block, 2)),
  ]);
};

export const indexMarkdown = (): string =>
  print([
    heading(1, [{ type: "text", value: "zriz" }]),
    {
      children: [
        paragraph(
          "zriz is an image cropper for react with a straighten dial, like the crop tool in ios photos. it ships as `@zriz/react` and `@zriz/core`. every page below is markdown, and any page url plus `.md` returns the same."
        ),
        paragraph(
          `a skill for coding agents is at \`${origin}/skill.md\`, and an mcp server with the tools \`search_docs\` and \`get_page\` answers at \`${origin}/mcp\`.`
        ),
      ],
      type: "blockquote",
    },
    ...groups.flatMap((group) => [
      heading(2, [
        { type: "text", value: group.title === "" ? "start" : group.title },
      ]),
      list(
        group.items.map(({ slug, title }) =>
          item([
            {
              children: [
                {
                  children: [{ type: "text", value: title }],
                  type: "link",
                  url: urlOf(slug),
                },
                { type: "text", value: ": " },
                ...phrasing(docs[slug].lede),
              ],
              type: "paragraph",
            },
          ])
        )
      ),
    ]),
    heading(2, [{ type: "text", value: "everything" }]),
    list([
      item([
        {
          children: [
            {
              children: [{ type: "text", value: "all pages in one file" }],
              type: "link",
              url: `${origin}/llms-full.txt`,
            },
          ],
          type: "paragraph",
        },
      ]),
    ]),
  ]);

export const fullMarkdown = (): string =>
  entries.map(({ slug }) => pageMarkdown(slug, true)).join("\n---\n\n");
