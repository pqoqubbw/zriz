import { cn } from "@/lib/cn";
import { highlight } from "@/lib/doc/highlight";
import { languageOf } from "@/lib/doc/snippets";

const roles =
  "[&_.a]:text-code-attr [&_.c]:text-code-comment [&_.k]:text-accent [&_.n]:text-code-number [&_.p]:text-code-punct [&_.s]:text-code-string [&_.t]:text-code-tag";

export const CodeBlock = async ({
  className,
  code,
  file,
}: {
  className: string;
  code: string;
  file: string;
}) => (
  <figure
    aria-label={`${languageOf(file).fence} code`}
    className={cn(
      "rounded-panel bg-surface [scrollbar-width:thin] overflow-x-auto overscroll-x-contain",
      className
    )}
    tabIndex={0}
  >
    <pre className={cn("text-code text-code-ink font-mono", roles)}>
      <code
        className="block w-max p-4"
        dangerouslySetInnerHTML={{ __html: await highlight(code, file) }}
        data-copy-text=""
      />
    </pre>
  </figure>
);
