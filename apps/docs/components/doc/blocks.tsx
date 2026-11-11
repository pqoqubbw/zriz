import { cva } from "class-variance-authority";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { CodeFigure } from "@/components/doc/code-figure";
import { CodePanel } from "@/components/doc/code-panel";
import { CopyButton } from "@/components/doc/copy-button";
import { Controls, LiveCode, LiveLog } from "@/components/doc/deferred";
import { Demo } from "@/components/doc/demo";
import { Faq, FaqItem } from "@/components/doc/faq";
import { RegistryPreview } from "@/components/doc/registry-preview";
import { MessageList, PropList } from "@/components/doc/tables/definition-list";
import { TableBlock } from "@/components/doc/tables/grid-table";
import { PairTable } from "@/components/doc/tables/pair-table";
import { Text } from "@/components/doc/text";
import { Heading } from "@/components/ui/heading";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type { Anchors } from "@/lib/doc/anchors";
import { BLOCK_SLOTS, gap } from "@/lib/doc/flow";
import type { Before, Gap } from "@/lib/doc/flow";
import type { Block, BlockOf, Kind } from "@/lib/doc/schema";
import { languageOf } from "@/lib/doc/snippets";

type Context = {
  anchors: Anchors;
  className: string;
  level: 3 | 4;
};

type Renderer<K extends Kind> = (
  block: BlockOf<K>,
  context: Context
) => ReactNode;

type FlowProps = {
  anchors: Anchors;
  blocks: readonly Block[];
  first: Before;
  level: 3 | 4;
};

type DocBodyProps = {
  anchors: Anchors;
  blocks: readonly Block[];
};

const CODE_IDENTIFIER = /^[a-z]+[A-Z]\w*$/u;

const flowVariants = cva("", {
  variants: {
    gap: {
      0: "",
      12: "mt-3",
      16: "mt-4",
      20: "mt-5",
      24: "mt-6",
      28: "mt-7",
      4: "mt-1",
      40: "mt-10",
    } satisfies Record<Gap, string>,
  },
});

const renderCode: Renderer<"code" | "excerpt"> = (block, { className }) => (
  <CodeFigure block={block} className={className} />
);

const renderPairs: Renderer<"attrs" | "keys" | "variables"> = (
  block,
  { className }
) => <PairTable className={className} kind={block.kind} rows={block.rows} />;

const renderers: { [K in Kind]: Renderer<K> } = {
  attrs: renderPairs,
  caption: (block, { className, level }) => (
    <Heading className={className} level={level} variant="mono">
      {block.text}
    </Heading>
  ),
  code: renderCode,
  controls: (block, { className }) => (
    <Controls
      className={className}
      controls={block.controls}
      {...(block.bind === undefined ? {} : { bind: block.bind })}
    />
  ),
  demo: (block, { className }) => (
    <Demo className={className} name={block.name} />
  ),
  excerpt: renderCode,
  intro: (block, context) => (
    <div className="flex flex-col pb-14">
      <Flow
        anchors={context.anchors}
        blocks={block.blocks}
        first={null}
        level={3}
      />
    </div>
  ),
  keys: renderPairs,
  liveCode: (block, { className }) => (
    <CodePanel
      className={className}
      label={`${languageOf(block.file).fence.toUpperCase()} code`}
    >
      <LiveCode feed={block.feed} />
    </CodePanel>
  ),
  log: (block, { className }) =>
    block.bind === "playground" ? (
      <Panel className={cn("font-mono text-code", className)} layout="box">
        <Panel
          aria-label="Events, newest first"
          aria-live="off"
          className="h-40 scrollbar-none overflow-y-auto overscroll-y-contain rounded-none bg-transparent"
          radius="demo"
          role="log"
          tabIndex={0}
        >
          <LiveLog />
        </Panel>
      </Panel>
    ) : (
      <Panel className={cn("font-mono text-code", className)} layout="box">
        {block.lines.map((line, i) => (
          <div className="flex gap-4" key={`${i}-${line.event}`}>
            <span className="w-20 shrink-0 text-faint">{line.time}</span>{" "}
            <span>{line.event}</span>
          </div>
        ))}
      </Panel>
    ),
  messages: (block, { className }) => (
    <MessageList className={className} label={block.label} rows={block.rows} />
  ),
  p: (block, { className }) => (
    <p className={className}>
      <Text source={block.text} />
    </p>
  ),
  part: (block, context) => (
    <div className={cn("flex flex-col", context.className)}>
      <div className="flex flex-col gap-1">
        <Heading id={context.anchors.of(block)} level={3} variant="mono">
          {block.name}
        </Heading>
        {block.text !== "" && (
          <p>
            <Text source={block.text} />
          </p>
        )}
      </div>
      <Flow
        anchors={context.anchors}
        blocks={block.blocks}
        first="head"
        level={4}
      />
    </div>
  ),
  preview: (block, { className }) => (
    <RegistryPreview className={className} name={block.name} />
  ),
  prompt: (block, { className }) => (
    <Panel className={className} data-copy="" layout="prompt">
      <p className="min-w-0 flex-1 wrap-break-word" data-copy-text="">
        <Text source={block.text} />
      </p>
      <CopyButton label="Copy prompt" />
    </Panel>
  ),
  props: (block, { className }) => (
    <PropList className={className} label={block.label} rows={block.rows} />
  ),
  qa: (block, context) => (
    <FaqItem id={context.anchors.of(block)} question={block.question}>
      <Flow
        anchors={context.anchors}
        blocks={block.blocks}
        first="answer"
        level={4}
      />
    </FaqItem>
  ),
  section: (block, context) => (
    <section className="flex flex-col pb-14" data-copy="">
      <Heading
        id={context.anchors.of(block)}
        level={2}
        variant={CODE_IDENTIFIER.test(block.title) ? "section-mono" : "section"}
      >
        {block.title}
      </Heading>
      <Flow
        anchors={context.anchors}
        blocks={block.blocks}
        first="label"
        level={3}
      />
    </section>
  ),
  table: (block, { className }) => (
    <TableBlock block={block} className={className} />
  ),
  variables: renderPairs,
};

const render = <K extends Kind>(
  block: BlockOf<K>,
  context: Context
): ReactNode => renderers[block.kind](block, context);

const questionsFrom = (
  blocks: readonly Block[],
  start: number
): BlockOf<"qa">[] => {
  const run: BlockOf<"qa">[] = [];

  for (const block of blocks.slice(start)) {
    if (block.kind !== "qa") {
      break;
    }

    run.push(block);
  }

  return run;
};

const Flow = ({ anchors, blocks, first, level }: FlowProps): ReactNode =>
  blocks.map((block, i) => {
    const previous = blocks[i - 1];
    const before = previous === undefined ? first : BLOCK_SLOTS[previous.kind];
    const className = flowVariants({
      gap: gap(first === "answer" ? "answer" : before, BLOCK_SLOTS[block.kind]),
    });

    if (block.kind === "qa") {
      if (previous?.kind === "qa") {
        return null;
      }

      const questions = questionsFrom(blocks, i);

      return (
        <Faq
          className={className}
          ids={questions.map((question) => anchors.of(question))}
          key={`${i}-${block.kind}`}
        >
          {questions.map((question, j) => (
            <Fragment key={`${j}-${question.question}`}>
              {render(question, { anchors, className: "", level })}
            </Fragment>
          ))}
        </Faq>
      );
    }

    return (
      <Fragment key={`${i}-${block.kind}`}>
        {render(block, { anchors, className, level })}
      </Fragment>
    );
  });

const DocBody = ({ anchors, blocks }: DocBodyProps) =>
  blocks.map((block, i) =>
    block.kind === "demo" ? (
      <Demo
        className=""
        key={`${i}-${block.name}`}
        name={block.name}
        space={block.space ?? 40}
      />
    ) : (
      <Flow
        anchors={anchors}
        blocks={[block]}
        first={null}
        key={`${i}-${block.kind === "section" ? block.title : block.kind}`}
        level={3}
      />
    )
  );

export { DocBody };
