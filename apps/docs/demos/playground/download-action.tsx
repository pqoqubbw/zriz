"use client";

import { Button } from "@/components/ui/button";
import { playground } from "@/demos/playground/store";
import { usePlayground } from "@/demos/playground/use-playground";

type DownloadActionProps = {
  label: string;
};

const DownloadAction = ({ label }: DownloadActionProps) => {
  const ready = usePlayground((state) => state.ready);
  const busy = usePlayground((state) => state.busy);

  return (
    <Button
      aria-busy={busy || undefined}
      disabled={!ready}
      onClick={() => {
        void playground.download();
      }}
    >
      {label}
    </Button>
  );
};

export { DownloadAction };
