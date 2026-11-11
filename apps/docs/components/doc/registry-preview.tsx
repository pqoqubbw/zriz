"use client";

import { cva } from "class-variance-authority";
import dynamic from "next/dynamic";

import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type { RegistryName } from "@/lib/registry";

type RegistryPreviewProps = {
  className: string;
  name: RegistryName;
};

const PREVIEWS = {
  "avatar-cropper": dynamic(
    async () => await import("@/registry/demos/avatar-cropper"),
    { ssr: false }
  ),
  "cover-cropper": dynamic(
    async () => await import("@/registry/demos/cover-cropper"),
    { ssr: false }
  ),
  cropper: dynamic(async () => await import("@/registry/demos/cropper"), {
    ssr: false,
  }),
  "image-crop-dialog": dynamic(
    async () => await import("@/registry/demos/image-crop-dialog"),
    { ssr: false }
  ),
  "image-crop-field": dynamic(
    async () => await import("@/registry/demos/image-crop-field"),
    { ssr: false }
  ),
  "image-editor": dynamic(
    async () => await import("@/registry/demos/image-editor"),
    { ssr: false }
  ),
} as const satisfies Record<RegistryName, unknown>;

const stageVariants = cva(
  "flex w-full items-center justify-center rounded-control bg-white p-6 shadow-raised max-sm:p-4",
  {
    variants: {
      name: {
        "avatar-cropper": "min-h-36",
        "cover-cropper": "min-h-56",
        cropper: "min-h-104",
        "image-crop-dialog": "min-h-36",
        "image-crop-field": "min-h-100",
        "image-editor": "min-h-136",
      } satisfies Record<RegistryName, string>,
    },
  }
);

const RegistryPreview = ({ className, name }: RegistryPreviewProps) => {
  const Preview = PREVIEWS[name];

  return (
    <Panel
      className={cn("p-1", className)}
      data-markdown-ignore=""
      data-preview={name}
      radius="demo"
    >
      <div className={stageVariants({ name })} data-registry="">
        <Preview />
      </div>
    </Panel>
  );
};

export { RegistryPreview };
