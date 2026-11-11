import type { Paragraph, PhrasingContent, RootContent } from "mdast";

import { DEMO_SPECS } from "@/demos/registry";
import { piecesOf } from "@/lib/doc/inline";
import {
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
} from "@/lib/doc/mdast";
import { LEVEL_WORDS, TABLE_HEADS } from "@/lib/doc/schema";
import type { Block, BlockOf, Chord, Kind, Verdict } from "@/lib/doc/schema";
import { languageOf, textOf } from "@/lib/doc/snippets";
import { DOCS } from "@/lib/docs";
import { titleOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";
import { LLMS_URL, markdownUrl, pageUrl } from "@/lib/site";

type Nested = (blocks: readonly Block[], depth: number) => RootContent[];

type Converter<K extends Kind> = (
  block: BlockOf<K>,
  depth: number,
  nested: Nested
) => RootContent[];

const phrasing = (source: string): PhrasingContent[] =>
  piecesOf(source).map((piece) => {
    if (piece.kind === "code") {
      return inlineCode(piece.text);
    }

    if (piece.kind === "external") {
      return link(piece.href, piece.text);
    }

    if (piece.kind === "link") {
      return link(markdownUrl(piece.slug, piece.anchor), piece.text);
    }

    return text(piece.text);
  });

const prose = (source: string): Paragraph => paragraph(phrasing(source));

const verdictPhrasing = ([level, note]: Verdict): PhrasingContent[] =>
  phrasing(
    note === undefined ? LEVEL_WORDS[level] : `${LEVEL_WORDS[level]}. ${note}`
  );

const chordPhrasing = (chords: readonly Chord[]): PhrasingContent[] =>
  chords.flatMap((chord, i) => [
    ...(i > 0 ? [text(" or ")] : []),
    ...chord.flatMap((name, j) => [
      ...(j > 0 ? [text(" + ")] : []),
      inlineCode(name),
    ]),
  ]);

const fenceOf = (
  block: BlockOf<"code" | "excerpt" | "log" | "prompt">
): RootContent[] => {
  if (block.kind === "log") {
    return [
      fence(
        "text",
        block.lines.map((line) => `${line.time}  ${line.event}`).join("\n")
      ),
    ];
  }

  if (block.kind === "prompt") {
    return [fence("text", block.text)];
  }

  return [fence(languageOf(block.file).fence, textOf(block))];
};

const pairTableOf = (block: BlockOf<"attrs" | "variables">): RootContent[] => [
  table(
    TABLE_HEADS[block.kind],
    block.rows.map((entry) => [[inlineCode(entry.name)], phrasing(entry.text)])
  ),
];

const controlText = (
  control: BlockOf<"controls">["controls"][number]
): string => {
  if (control.type === "choice") {
    return control.options.map((option) => `\`${option}\``).join(", ");
  }

  if (control.type === "range") {
    return `from ${control.min}${control.unit} to ${control.max}${control.unit}`;
  }

  return "on or off";
};

const signatureOf = (
  entry: BlockOf<"props">["rows"][number]
): PhrasingContent[] => [
  inlineCode(entry.name),
  ...(entry.type === undefined ? [] : [text(" "), inlineCode(entry.type)]),
  ...(entry.required === true ? [text(" required")] : []),
  ...(entry.default === undefined
    ? []
    : [text(" = "), inlineCode(entry.default)]),
];

const converters: { [K in Kind]: Converter<K> } = {
  attrs: pairTableOf,
  caption: (block, depth) => [heading(depth, [inlineCode(block.text)])],
  code: fenceOf,
  compare: (block) => [
    table(
      ["Feature", ...block.names],
      block.rows.map(([feature, theirs, ours]) => [
        phrasing(feature),
        verdictPhrasing(theirs),
        verdictPhrasing(ours),
      ])
    ),
  ],
  controls: (block) => [
    list(
      block.controls.map((control) =>
        item([prose(`\`${control.name}\`: ${controlText(control)}`)])
      )
    ),
  ],
  demo: (block) => [
    prose(
      `The page at ${pageUrl(block.name)} runs this cropper: ${DEMO_SPECS[block.name].summary}.`
    ),
  ],
  entries: (block) => [
    list(
      block.rows.map((row) =>
        item([
          prose(
            row.meta === undefined
              ? `${row.title}. ${row.text}`
              : `${row.title}, ${row.meta}. ${row.text}`
          ),
        ])
      )
    ),
  ],
  excerpt: fenceOf,
  intro: (block, depth, nested) => nested(block.blocks, depth),
  keys: (block) => [
    table(
      TABLE_HEADS.keys,
      block.rows.map((entry) => [
        chordPhrasing(entry.keys),
        phrasing(entry.text),
      ])
    ),
  ],
  liveCode: (block) => fenceOf({ file: block.file, kind: "code" }),
  log: fenceOf,
  messages: (block) => [
    list(
      block.rows.map((entry) =>
        item([paragraph([inlineCode(entry.message)]), prose(entry.fix)])
      )
    ),
  ],
  p: (block) => [prose(block.text)],
  part: (block, depth, nested) => [
    heading(depth, [inlineCode(block.name)]),
    ...(block.text === "" ? [] : [prose(block.text)]),
    ...nested(block.blocks, depth + 1),
  ],
  prompt: fenceOf,
  props: (block) => [
    list(
      block.rows.map((entry) =>
        item([paragraph(signatureOf(entry)), prose(entry.text)])
      )
    ),
  ],
  qa: (block, depth, nested) => [
    heading(depth, [text(block.question)]),
    ...nested(block.blocks, depth + 1),
  ],
  section: (block, depth, nested) => [
    heading(depth, [text(block.title)]),
    ...nested(block.blocks, depth + 1),
  ],
  table: (block) => {
    const head = block.columns.map((column) => column.label);

    return [
      table(
        head,
        block.rows.map((cells) =>
          head.map((_, i) => {
            const value = cells[i] ?? "";

            if (block.columns[i]?.kind === "mono") {
              return [inlineCode(value)];
            }

            if (block.fix !== undefined && i === head.length - 1) {
              return phrasing(`${value}. ${cells[head.length] ?? ""}`);
            }

            return phrasing(value);
          })
        )
      ),
    ];
  },
  variables: pairTableOf,
};

const convert = <K extends Kind>(
  block: BlockOf<K>,
  depth: number
): RootContent[] =>
  converters[block.kind](block, depth, (blocks, level) =>
    blocks.flatMap((child) => convert(child, level))
  );

const pageMarkdown = (slug: Slug, full = false): string => {
  const doc = DOCS[slug];

  return printMarkdown([
    heading(1, [text(titleOf(slug))]),
    full
      ? prose(`source: ${markdownUrl(slug)}`)
      : blockquote([paragraph([link(LLMS_URL, "llms.txt")])]),
    prose(doc.lede),
    ...doc.blocks.flatMap((block) => convert(block, 2)),
  ]);
};

export { pageMarkdown, phrasing, prose };
