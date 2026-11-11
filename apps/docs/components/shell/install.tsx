"use client";

import { CopiedStatus, useCopy } from "@/components/doc/copy-button";
import { Icon } from "@/components/ui/icon";

type InstallProps = {
  command: string;
};

const Install = ({ command }: InstallProps) => {
  const { copied, onClick } = useCopy();

  return (
    <>
      <button
        aria-label="Copy install command"
        className="group flex h-6 w-full cursor-copy items-center justify-between gap-2 text-left"
        data-copy=""
        onClick={onClick}
        type="button"
      >
        <code
          className="font-mono text-code whitespace-nowrap text-code-ink"
          data-copy-text=""
        >
          {command}
        </code>
        <Icon
          className="size-4 shrink-0 opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100"
          name={copied ? "check" : "copy"}
        />
      </button>
      <CopiedStatus copied={copied} />
    </>
  );
};

export { Install };
