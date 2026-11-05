"use client";

import * as Cropper from "@zriz/react/cropper";
import { useRef } from "react";

import type { DemoAction } from "@/demos/registry";
import { ChipContent, chipVariants } from "@/demos/shell/chip";
import { Corner } from "@/demos/shell/layout";
import type { Download } from "@/demos/shell/use-download";
import type { Photo } from "@/demos/shell/use-photo";

type FileChipsProps = {
  action: DemoAction;
  dim: boolean;
  download: Download;
  photo: Photo;
};

type OpenChipProps = {
  photo: Photo;
};

type ActionChipProps = {
  action: DemoAction;
  download: Download;
  off: boolean;
};

const OpenChip = ({ photo }: OpenChipProps) => {
  const input = useRef<HTMLInputElement>(null);
  const failed = photo.error !== null;

  return (
    <Corner side="start">
      <button
        aria-label={failed ? `${photo.error}. Open a photo` : "Open a photo"}
        className={chipVariants({ tone: failed ? "error" : "default" })}
        onClick={() => input.current?.click()}
        type="button"
      >
        <ChipContent
          icon={failed ? "warning" : "open-image"}
          label={photo.error ?? "open"}
        />
      </button>
      <input
        accept="image/*"
        aria-label="Photo file"
        className="hidden"
        onChange={photo.handlePick}
        ref={input}
        tabIndex={-1}
        type="file"
      />
      <output className="sr-only">{photo.error}</output>
    </Corner>
  );
};

const spoken = (label: string): string =>
  `${label.charAt(0).toUpperCase()}${label.slice(1)}`;

const ActionChip = ({ action, download, off }: ActionChipProps) => {
  const label = download.done ? action.done : action.label;

  return (
    <button
      aria-disabled={off || undefined}
      aria-label={spoken(label)}
      className={chipVariants({ size: "fixed" })}
      data-dim={off ? "" : undefined}
      onClick={() => {
        if (!off) {
          void download.run();
        }
      }}
      type="button"
    >
      <ChipContent
        collapse
        icon={download.done ? "check" : action.icon}
        label={label}
      />
    </button>
  );
};

const FileChips = ({ action, dim, download, photo }: FileChipsProps) => (
  <>
    <OpenChip photo={photo} />
    <Corner side="end">
      <Cropper.Reset
        aria-label="Reset"
        className={chipVariants({ size: "collapse" })}
        data-dim={dim ? "" : undefined}
      >
        <ChipContent collapse icon="reset" label="reset" />
      </Cropper.Reset>
      <ActionChip
        action={action}
        download={download}
        off={dim || !photo.ready || download.busy}
      />
    </Corner>
  </>
);

export { FileChips };
