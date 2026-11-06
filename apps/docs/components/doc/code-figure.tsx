import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { highlight } from "@/lib/doc/highlight";
import type { BlockOf } from "@/lib/doc/schema";
import { languageOf, textOf } from "@/lib/doc/snippets";

type CodeFigureProps = {
  block: BlockOf<"code" | "excerpt">;
  className: string;
};

const CodeFigure = async ({ block, className }: CodeFigureProps) => (
  <Panel
    aria-label={`${languageOf(block.file).fence.toUpperCase()} code`}
    as="figure"
    className={cn(
      "scrollbar-none overflow-x-auto overscroll-x-contain max-sm:[border-image-outset:0]",
      className
    )}
    tabIndex={0}
  >
    <pre className="font-mono text-code text-code-ink">
      <code
        className="block w-max p-4"
        dangerouslySetInnerHTML={{
          __html: await highlight(textOf(block), block.file),
        }}
        data-copy-text=""
      />
    </pre>
  </Panel>
);

export { CodeFigure };
