import { CodePanel } from "@/components/doc/code-panel";
import { highlight } from "@/lib/doc/highlight";
import type { BlockOf } from "@/lib/doc/schema";
import { languageOf, textOf } from "@/lib/doc/snippets";

type CodeFigureProps = {
  block: BlockOf<"code" | "excerpt">;
  className: string;
};

const CodeFigure = async ({ block, className }: CodeFigureProps) => (
  <CodePanel
    className={className}
    label={`${languageOf(block.file).fence.toUpperCase()} code`}
  >
    <code
      className="block w-max py-4 pr-12 pl-4"
      dangerouslySetInnerHTML={{
        __html: await highlight(textOf(block), block.file),
      }}
      data-copy-text=""
    />
  </CodePanel>
);

export { CodeFigure };
