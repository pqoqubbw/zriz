"use client";

import { CopiedStatus, useCopy } from "@/components/doc/copy-button";
import type { CopyProps } from "@/components/doc/copy-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type CopyActionProps = CopyProps & {
  read?: () => string | null;
};

const CopyAction = ({ label, read }: CopyActionProps) => {
  const { copied, onClick } = useCopy(read);

  return (
    <>
      <Button onClick={onClick}>
        <span className="grid">
          <span
            className={cn("col-start-1 row-start-1", copied && "invisible")}
          >
            {label}
          </span>
          <span
            aria-hidden="true"
            className={cn("col-start-1 row-start-1", !copied && "invisible")}
          >
            copied
          </span>
        </span>
      </Button>
      <CopiedStatus copied={copied} />
    </>
  );
};

export type { CopyActionProps };
export { CopyAction };
