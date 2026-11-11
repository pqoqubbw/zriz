"use client";

import { useState } from "react";

import { describeFile, PHOTO } from "@/registry/demos/photo";
import { ImageCropField } from "@/registry/new-york/blocks/image-crop-field";
import { Button } from "@/registry/new-york/ui/button";

const ImageCropFieldDemo = () => {
  const [sent, setSent] = useState<string | null>(null);

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const file = new FormData(event.currentTarget).get("cover");

        setSent(
          file instanceof File && file.size > 0
            ? `Sent ${describeFile(file)}`
            : "No image to send"
        );
      }}
    >
      <ImageCropField defaultImage={PHOTO} label="Cover image" name="cover" />
      <div className="flex items-center gap-3">
        <Button type="submit">Submit</Button>
        {sent === null ? null : (
          <output className="text-xs text-muted-foreground">{sent}</output>
        )}
      </div>
    </form>
  );
};

export default ImageCropFieldDemo;
