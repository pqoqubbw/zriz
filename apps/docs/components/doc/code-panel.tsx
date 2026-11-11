import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/doc/copy-button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

type CodePanelProps = {
  children: ReactNode;
  className: string;
  label: string;
  single?: boolean;
};

const copyVariants = cva("absolute right-2 max-sm:hidden", {
  variants: {
    single: {
      false: "top-2",
      true: "top-1/2 -translate-y-1/2",
    },
  },
});

const CodePanel = ({
  children,
  className,
  label,
  single = false,
}: CodePanelProps) => (
  <div className={cn("relative", className)} data-copy="">
    <Panel
      aria-label={label}
      as="figure"
      className="scrollbar-none overflow-x-auto overscroll-x-contain max-sm:[border-image-outset:0]"
      tabIndex={0}
    >
      <pre className="font-mono text-code text-code-ink">{children}</pre>
    </Panel>
    <div className={copyVariants({ single })}>
      <CopyButton label="Copy code" />
    </div>
  </div>
);

export type { CodePanelProps };
export { CodePanel };
