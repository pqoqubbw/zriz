import type { ReactNode } from "react";

import { CopyButton } from "@/components/doc/copy-button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

type CodePanelProps = {
  children: ReactNode;
  className: string;
  label: string;
};

const CodePanel = ({ children, className, label }: CodePanelProps) => (
  <div className={cn("relative", className)} data-copy="">
    <Panel
      aria-label={label}
      as="figure"
      className="scrollbar-none overflow-x-auto overscroll-x-contain max-sm:[border-image-outset:0]"
      tabIndex={0}
    >
      <pre className="font-mono text-code text-code-ink">{children}</pre>
    </Panel>
    <div className="absolute top-2 right-2">
      <CopyButton label="Copy code" />
    </div>
  </div>
);

export type { CodePanelProps };
export { CodePanel };
