import dynamic from "next/dynamic";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { CodeBlock } from "@/components/doc/code-block";
import { CopyAction, CopyButton } from "@/components/doc/copy-button";
import { Demo } from "@/components/doc/demo";
import {
  KeyTable,
  Messages,
  NamedTable,
  Signatures,
  Table,
} from "@/components/doc/tables";
import { Text } from "@/components/doc/text";
import { cn } from "@/lib/cn";
import type { Anchors } from "@/lib/doc/anchors";
import { gapClass, slotOf } from "@/lib/doc/flow";
import type { Slot } from "@/lib/doc/flow";
import type { Block, BlockOf, Kind } from "@/lib/doc/schema";
import { textOf } from "@/lib/doc/snippets";
import { bleed } from "@/lib/styles";

type Before = Slot | "answer" | null;

interface Context {
  anchors: Anchors;
  className: string;
  flow: (blocks: readonly Block[], first: Before, level: 3 | 4) => ReactNode;
  level: 3 | 4;
}

type Renderer<K extends Kind> = (
  block: BlockOf<K>,
  context: Context
) => ReactNode;

const Controls = dynamic(async () => {
  const loaded = await import("@/components/doc/controls");
  return loaded.Controls;
});

const identifier = /^[a-z]+[A-Z]\w*$/u;

const Heading = ({
  children,
  className,
  id,
  level,
}: {
  children: ReactNode;
  className: string;
  id: string;
  level: 2 | 3 | 4;
}) => {
  const Tag = `h${level}` as const;
  return (
    <Tag className={className} id={id}>
      <a
        className="decoration-underline decoration-1 [text-underline-position:from-font] hover:underline"
        href={`#${id}`}
      >
        {children}
      </a>
    </Tag>
  );
};

const renderers: { [K in Kind]: Renderer<K> } = {
  actions: (block, { className }) => (
    <div className={cn("flex gap-2", className)}>
      {block.action === "copy-value" ? (
        <CopyAction label={block.label} />
      ) : (
        <button
          className="rounded-control text-control shadow-button flex h-8 items-center bg-white px-3.5 font-medium opacity-40"
          disabled
          type="button"
        >
          {block.label}
        </button>
      )}
    </div>
  ),
  attrs: (block, { className }) => (
    <NamedTable className={className} kind="attrs" rows={block.rows} />
  ),
  caption: (block, { className, level }) => {
    const Tag = `h${level}` as const;
    return (
      <Tag className={cn("text-body font-mono font-semibold", className)}>
        {block.text}
      </Tag>
    );
  },
  code: (block, { className }) => (
    <CodeBlock className={className} code={textOf(block)} file={block.file} />
  ),
  controls: (block, { className }) => (
    <Controls className={className} controls={block.controls} />
  ),
  demo: (block, { className }) => (
    <Demo className={className} name={block.name} />
  ),
  excerpt: (block, { className }) => (
    <CodeBlock className={className} code={textOf(block)} file={block.file} />
  ),
  intro: (block, context) => (
    <div className="flex flex-col pb-14">
      {context.flow(block.blocks, null, 3)}
    </div>
  ),
  keys: (block, { className }) => (
    <KeyTable className={className} rows={block.rows} />
  ),
  list: (block, { className }) => (
    <ul className={cn("flex flex-col gap-2", className)}>
      {block.items.map((item) => (
        <li
          className="before:bg-dot relative pl-4.5 before:absolute before:top-2.25 before:left-0.5 before:size-1 before:rounded-full"
          key={item}
        >
          <Text source={item} />
        </li>
      ))}
    </ul>
  ),
  log: (block, { className }) => (
    <div
      className={cn(
        cn(
          "rounded-panel bg-surface text-code flex flex-col p-4 font-mono",
          bleed
        ),
        className
      )}
    >
      {block.lines.map((line, i) => (
        <div className="flex gap-4" key={`${i}-${line.event}`}>
          <span className="text-faint w-20 shrink-0">{line.time}</span>{" "}
          <span>{line.event}</span>
        </div>
      ))}
    </div>
  ),
  messages: (block, { className }) => (
    <Messages className={className} label={block.label} rows={block.rows} />
  ),
  p: (block, { className }) => (
    <p className={className}>
      <Text source={block.text} />
    </p>
  ),
  part: (block, context) => (
    <div className={cn("flex flex-col", context.className)}>
      <div className="flex flex-col gap-1">
        <Heading
          className="text-body font-mono font-semibold"
          id={context.anchors.of(block)}
          level={3}
        >
          {block.name}
        </Heading>
        {block.text !== "" && (
          <p>
            <Text source={block.text} />
          </p>
        )}
      </div>
      {context.flow(block.blocks, "head", 4)}
    </div>
  ),
  prompt: (block, { className }) => (
    <div
      className={cn(
        cn(
          "rounded-panel bg-surface flex items-start gap-3 py-4 pr-3 pl-4",
          bleed
        ),
        className
      )}
      data-copy=""
    >
      <p className="min-w-0 flex-1 break-words" data-copy-text="">
        <Text source={block.text} />
      </p>
      <CopyButton label="Copy prompt" />
    </div>
  ),
  props: (block, { className }) => (
    <Signatures className={className} label={block.label} rows={block.rows} />
  ),
  qa: (block, context) => (
    <div className={cn("flex flex-col", context.className)}>
      <Heading
        className="text-body font-strong"
        id={context.anchors.of(block)}
        level={3}
      >
        {block.question}
      </Heading>
      {context.flow(block.blocks, "answer", 4)}
    </div>
  ),
  section: (block, context) => (
    <section className="flex flex-col pb-14" data-copy="">
      <Heading
        className={
          identifier.test(block.title)
            ? "text-heading-mono font-mono"
            : "text-heading"
        }
        id={context.anchors.of(block)}
        level={2}
      >
        {block.title}
      </Heading>
      {context.flow(block.blocks, "label", 3)}
    </section>
  ),
  sub: (block, { className, level }) => {
    const Tag = `h${level}` as const;
    return (
      <Tag className={cn("text-body font-strong", className)}>
        <Text source={block.text} />
      </Tag>
    );
  },
  table: (block, { className }) => (
    <Table block={block} className={className} />
  ),
  variables: (block, { className }) => (
    <NamedTable className={className} kind="variables" rows={block.rows} />
  ),
};

const render = <K extends Kind>(
  block: BlockOf<K>,
  context: Context
): ReactNode => renderers[block.kind](block, context);

const spaces = {
  40: "pb-10",
  48: "pb-12",
  56: "pb-14",
} as const;

const spaceOf = (before: Before, block: Block): string => {
  if (before === "answer") {
    return block.kind === "code" || block.kind === "excerpt" ? "mt-3" : "mt-1";
  }
  return before === null ? "" : gapClass(before, slotOf[block.kind]);
};

export const Flow = ({
  anchors,
  blocks,
  first,
  level,
}: {
  anchors: Anchors;
  blocks: readonly Block[];
  first: Before;
  level: 3 | 4;
}): ReactNode =>
  blocks.map((block, i) => {
    const previous = blocks[i - 1];
    const before = previous === undefined ? first : slotOf[previous.kind];
    return (
      <Fragment key={`${i}-${block.kind}`}>
        {render(block, {
          anchors,
          className: spaceOf(first === "answer" ? "answer" : before, block),
          flow: (inner, start, depth) => (
            <Flow
              anchors={anchors}
              blocks={inner}
              first={start}
              level={depth}
            />
          ),
          level,
        })}
      </Fragment>
    );
  });

export const Page = ({
  anchors,
  blocks,
}: {
  anchors: Anchors;
  blocks: readonly Block[];
}) =>
  blocks.map((block) =>
    block.kind === "demo" ? (
      <div className={spaces[block.space ?? 40]} key={block.name}>
        <Demo className="" name={block.name} />
      </div>
    ) : (
      <Flow
        anchors={anchors}
        blocks={[block]}
        first={null}
        key={block.kind === "section" ? block.title : block.kind}
        level={3}
      />
    )
  );
